import type { AccountType, BalanceType } from '@prisma/client';
import { dateRange, fromDbDate, toDbDate } from './dates';
import { num, round2 } from './money';
import { prisma, type Tx } from './prisma';

// Balance = signed opening + Σcredit − Σdebit. Positive = we owe them (payable).

export const signedOpening = (amount: number, type: BalanceType) =>
  type === 'CR' ? num(amount) : -num(amount);

type Totals = { debit: number; credit: number };

/** Sum of ledger debits/credits per account id. */
export async function ledgerTotals(
  accountType: AccountType,
  ids?: string[],
  opts: { before?: string; db?: Tx } = {},
): Promise<Map<string, Totals>> {
  const db = opts.db ?? prisma;
  const key = accountType === 'PARTY' ? 'partyId' : 'labourId';
  const rows = await db.ledgerEntry.groupBy({
    by: [key],
    where: {
      accountType,
      ...(ids ? { [key]: { in: ids } } : {}),
      ...(opts.before ? { date: { lt: toDbDate(opts.before) } } : {}),
    },
    _sum: { debit: true, credit: true },
  });
  const map = new Map<string, Totals>();
  for (const r of rows) {
    const id = (r as Record<string, unknown>)[key] as string | null;
    if (id == null) continue;
    map.set(id, { debit: num(r._sum.debit), credit: num(r._sum.credit) });
  }
  return map;
}

export async function partyBalances(ids?: string[]) {
  const [parties, totals] = await Promise.all([
    prisma.party.findMany({
      where: ids ? { id: { in: ids } } : {},
      select: { id: true, openingBalance: true, openingType: true },
    }),
    ledgerTotals('PARTY', ids),
  ]);
  const map = new Map<string, { opening: number; debit: number; credit: number; balance: number }>();
  for (const p of parties) {
    const opening = signedOpening(p.openingBalance, p.openingType);
    const t = totals.get(p.id) ?? { debit: 0, credit: 0 };
    map.set(p.id, { opening, ...t, balance: round2(opening + t.credit - t.debit) });
  }
  return map;
}

export async function labourBalances(ids?: string[]) {
  const totals = await ledgerTotals('LABOUR', ids);
  const map = new Map<string, { earned: number; paid: number; balance: number }>();
  for (const [id, t] of totals) map.set(id, { earned: t.credit, paid: t.debit, balance: round2(t.credit - t.debit) });
  return map;
}

/** Ledger statement with opening balance and running balance for a date range. */
export async function ledgerStatement(accountType: AccountType, accountId: string, from?: string, to?: string) {
  const key = accountType === 'PARTY' ? 'partyId' : 'labourId';
  let opening = 0;
  if (accountType === 'PARTY') {
    const party = await prisma.party.findUniqueOrThrow({ where: { id: accountId } });
    opening = signedOpening(party.openingBalance, party.openingType);
  }
  if (from) {
    const before = (await ledgerTotals(accountType, [accountId], { before: from })).get(accountId);
    if (before) opening += before.credit - before.debit;
  }
  opening = round2(opening);

  const entries = await prisma.ledgerEntry.findMany({
    where: { accountType, [key]: accountId, date: dateRange(from, to) },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { seq: 'asc' }],
  });

  let running = opening;
  let totalDebit = 0;
  let totalCredit = 0;
  const rows = entries.map((e) => {
    const debit = num(e.debit);
    const credit = num(e.credit);
    totalDebit += debit;
    totalCredit += credit;
    running = round2(running + credit - debit);
    return {
      id: e.id,
      date: fromDbDate(e.date),
      reference: e.reference,
      description: e.description,
      debit,
      credit,
      balance: running,
      purchaseId: e.purchaseId,
      paymentId: e.paymentId,
    };
  });

  return {
    opening,
    rows,
    totalDebit: round2(totalDebit),
    totalCredit: round2(totalCredit),
    closing: running,
  };
}
