import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from './prisma';
import { num } from './money';

// Posting service: turns source documents (purchase, payment, expense) into
// ledger rows and cash-book rows. Always call inside a transaction, after
// clearing any rows the document posted previously (see `unpost*`).

type LedgerRow = Omit<Prisma.LedgerEntryUncheckedCreateInput, 'id' | 'createdAt' | 'seq'>;
type CashRow = Omit<Prisma.CashEntryUncheckedCreateInput, 'id' | 'createdAt' | 'seq'>;

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

export const formatPurchaseNo = (serial: number) => `PUR-${String(serial).padStart(5, '0')}`;
export const formatVoucherNo = (serial: number) => `PV-${String(serial).padStart(5, '0')}`;

/**
 * Atomically take the next number of a named counter (e.g. 'purchase', 'payment').
 * Runs inside the caller's transaction, so an aborted save doesn't consume a number.
 */
export async function nextSerial(tx: Tx, name: 'purchase' | 'payment'): Promise<number> {
  const counter = await tx.counter.upsert({
    where: { name },
    update: { value: { increment: 1 } },
    create: { name, value: 1 },
  });
  return counter.value;
}

/** Peek at the number the next document would get (for previews only). */
export async function peekSerial(name: 'purchase' | 'payment'): Promise<number> {
  const counter = await prisma.counter.findUnique({ where: { name } });
  return (counter?.value ?? 0) + 1;
}

type PurchaseForPosting = Prisma.PurchaseGetPayload<{
  include: { party: { select: { name: true } }; labours: { include: { labour: { select: { name: true } } } } };
}>;

export function buildPurchaseEntries(p: PurchaseForPosting): { ledger: LedgerRow[]; cash: CashRow[] } {
  const ledger: LedgerRow[] = [];
  const cash: CashRow[] = [];
  const base = { date: p.date, reference: p.purchaseNo, purchaseId: p.id };
  const amount = num(p.amount);
  const rent = num(p.truckRent);
  const paid = num(p.amountPaid);
  const truck = `Truck ${p.vehicleNo}`;

  // Party: value of material received
  ledger.push({
    ...base,
    accountType: 'PARTY',
    partyId: p.partyId,
    description: `Purchase ${fmt(num(p.netWeight))} KG${p.material ? ` ${p.material}` : ''} @ ${fmt(num(p.rate))} — ${truck}`,
    credit: amount,
  });

  // Truck rent
  if (rent > 0 && p.truckRentPaidBy !== 'PARTY') {
    cash.push({
      ...base,
      method: p.truckRentMethod,
      direction: 'OUT',
      category: 'TRUCK_RENT',
      amount: rent,
      description: `Truck rent — ${truck}${p.truckRentPaidBy === 'DEDUCT' ? ` (deducted from ${p.party.name})` : ''}`,
    });
    if (p.truckRentPaidBy === 'DEDUCT') {
      ledger.push({
        ...base,
        accountType: 'PARTY',
        partyId: p.partyId,
        description: `Truck rent deducted — ${truck}`,
        debit: rent,
      });
    }
  }

  // Paid to party now
  if (paid > 0) {
    ledger.push({
      ...base,
      accountType: 'PARTY',
      partyId: p.partyId,
      description: `Paid at purchase (${p.paymentMethod.toLowerCase()})`,
      debit: paid,
    });
    cash.push({
      ...base,
      method: p.paymentMethod,
      direction: 'OUT',
      category: 'PURCHASE_PAYMENT',
      amount: paid,
      description: `Payment to ${p.party.name} — ${truck}`,
    });
  }

  // Offloading labour
  for (const row of p.labours) {
    const wage = num(row.wage);
    if (wage <= 0) continue;
    ledger.push({
      ...base,
      accountType: 'LABOUR',
      labourId: row.labourId,
      description: `Offloading wage — ${truck}`,
      credit: wage,
    });
    if (row.paid) {
      const method = row.paidMethod ?? 'CASH';
      ledger.push({
        ...base,
        accountType: 'LABOUR',
        labourId: row.labourId,
        description: `Wage paid on the spot (${method.toLowerCase()})`,
        debit: wage,
      });
      cash.push({
        ...base,
        method,
        direction: 'OUT',
        category: 'LABOUR_WAGE',
        amount: wage,
        description: `Wage to ${row.labour.name} — ${truck}`,
      });
    }
  }

  return { ledger, cash };
}

export async function postPurchase(tx: Tx, purchaseId: string) {
  const p = await tx.purchase.findUniqueOrThrow({
    where: { id: purchaseId },
    include: { party: { select: { name: true } }, labours: { include: { labour: { select: { name: true } } } } },
  });
  const { ledger, cash } = buildPurchaseEntries(p);
  // `seq` keeps the rows of one document in posting order when they share a date.
  if (ledger.length) await tx.ledgerEntry.createMany({ data: ledger.map((row, seq) => ({ ...row, seq })) });
  if (cash.length) await tx.cashEntry.createMany({ data: cash.map((row, seq) => ({ ...row, seq })) });
}

export async function unpostPurchase(tx: Tx, purchaseId: string) {
  await tx.ledgerEntry.deleteMany({ where: { purchaseId } });
  await tx.cashEntry.deleteMany({ where: { purchaseId } });
}

export async function postPayment(tx: Tx, paymentId: string) {
  const p = await tx.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { party: { select: { name: true } }, labour: { select: { name: true } } },
  });
  const amount = num(p.amount);
  const out = p.direction === 'OUT';
  const payee = p.party?.name ?? p.labour?.name ?? p.payeeName ?? 'Other';
  const base = { date: p.date, reference: p.voucherNo, paymentId: p.id };
  const note = p.note ? ` — ${p.note}` : '';

  if (p.payeeType === 'PARTY' || p.payeeType === 'LABOUR') {
    await tx.ledgerEntry.create({
      data: {
        ...base,
        accountType: p.payeeType,
        partyId: p.partyId,
        labourId: p.labourId,
        description: `${out ? 'Payment made' : 'Amount received'} (${p.method.toLowerCase()})${note}`,
        debit: out ? amount : 0,
        credit: out ? 0 : amount,
      },
    });
  }

  const category = !out
    ? 'RECEIPT'
    : p.payeeType === 'PARTY'
      ? 'PARTY_PAYMENT'
      : p.payeeType === 'LABOUR'
        ? 'LABOUR_PAYMENT'
        : 'OTHER_PAYMENT';
  await tx.cashEntry.create({
    data: {
      ...base,
      method: p.method,
      direction: p.direction,
      category,
      amount,
      description: `${out ? 'Paid to' : 'Received from'} ${payee}${note}`,
    },
  });
}

export async function unpostPayment(tx: Tx, paymentId: string) {
  await tx.ledgerEntry.deleteMany({ where: { paymentId } });
  await tx.cashEntry.deleteMany({ where: { paymentId } });
}

export async function postExpense(tx: Tx, expenseId: string) {
  const e = await tx.expense.findUniqueOrThrow({ where: { id: expenseId }, include: { category: true } });
  await tx.cashEntry.create({
    data: {
      date: e.date,
      method: e.paymentMethod,
      direction: 'OUT',
      category: 'EXPENSE',
      amount: e.amount,
      reference: `EXP-${e.id.slice(-6).toUpperCase()}`,
      description: [e.category.name, e.paidTo && `to ${e.paidTo}`, e.description].filter(Boolean).join(' — '),
      expenseId: e.id,
    },
  });
}

export async function unpostExpense(tx: Tx, expenseId: string) {
  await tx.cashEntry.deleteMany({ where: { expenseId } });
}
