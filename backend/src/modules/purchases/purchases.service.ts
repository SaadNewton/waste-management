import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../../lib/prisma';
import { badRequest, notFound } from '../../lib/errors';
import { toDbDate } from '../../lib/dates';
import { round2 } from '../../lib/money';
import { formatPurchaseNo, nextSerial, postPurchase, unpostPurchase } from '../../lib/posting';
import type { PurchaseInput } from './purchases.schema';

export const purchaseInclude = {
  party: { select: { id: true, name: true, phone: true, address: true } },
  labours: { include: { labour: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.PurchaseInclude;

/** Derive all computed columns from the user's input. The server is the source of truth. */
export function computePurchase(input: PurchaseInput) {
  const netWeight = round2(input.grossWeight - input.tareWeight);
  const amount = round2(input.amount ?? netWeight * input.rate);
  const truckRent = round2(input.truckRent);
  const labourCost = round2(input.labours.reduce((s, l) => s + l.wage, 0));
  const deducted = input.truckRentPaidBy === 'DEDUCT' ? truckRent : 0;
  const rentCost = input.truckRentPaidBy === 'ME' ? truckRent : 0;
  const grandTotal = round2(amount + rentCost + labourCost);
  const partyPayable = round2(amount - deducted - input.amountPaid);

  if (deducted > amount) throw badRequest('Truck rent to deduct cannot exceed the purchase amount');
  if (partyPayable < 0) {
    throw badRequest(`Amount paid cannot exceed the amount due to the party (${round2(amount - deducted)})`);
  }
  return { netWeight, amount, truckRent, labourCost, grandTotal, partyPayable };
}

/** Parties/labour must be active, unless they were already on the purchase being edited. */
async function assertReferences(tx: Tx, input: PurchaseInput, existing?: { partyId: string; labourIds: string[] }) {
  const party = await tx.party.findUnique({ where: { id: input.partyId } });
  if (!party) throw badRequest('Selected party does not exist');
  if ((!party.isActive || party.deletedAt) && existing?.partyId !== party.id) {
    throw badRequest('Selected party is inactive');
  }
  const ids = [...new Set(input.labours.map((l) => l.labourId))];
  if (!ids.length) return;
  const labour = await tx.labour.findMany({ where: { id: { in: ids } } });
  for (const id of ids) {
    const l = labour.find((x) => x.id === id);
    if (!l) throw badRequest(`Labour #${id} does not exist`);
    if ((!l.isActive || l.deletedAt) && !existing?.labourIds.includes(id)) {
      throw badRequest(`${l.name} is inactive`);
    }
  }
}

function toData(input: PurchaseInput) {
  const c = computePurchase(input);
  return {
    date: toDbDate(input.date),
    partyId: input.partyId,
    vehicleNo: input.vehicleNo,
    driverName: input.driverName,
    driverPhone: input.driverPhone,
    material: input.material,
    grossWeight: input.grossWeight,
    tareWeight: input.tareWeight,
    rate: input.rate,
    truckRentPaidBy: input.truckRentPaidBy,
    truckRentMethod: input.truckRentMethod,
    amountPaid: input.amountPaid,
    paymentMethod: input.paymentMethod,
    notes: input.notes,
    ...c,
  };
}

const labourRows = (input: PurchaseInput) =>
  input.labours.map((l) => ({ labourId: l.labourId, wage: l.wage, paid: l.paid, paidMethod: l.paid ? l.paidMethod : null }));

export async function createPurchase(input: PurchaseInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    // Validate everything before reserving a slip number so rejected saves don't leave gaps.
    const data = toData(input);
    await assertReferences(tx, input);
    const serialNo = await nextSerial(tx, 'purchase');
    const purchase = await tx.purchase.create({
      data: {
        ...data,
        serialNo,
        purchaseNo: formatPurchaseNo(serialNo),
        createdById: userId,
        labours: { create: labourRows(input) },
      },
    });
    await postPurchase(tx, purchase.id);
    return tx.purchase.findUniqueOrThrow({ where: { id: purchase.id }, include: purchaseInclude });
  });
}

/** Reverse the old postings, replace the document and re-post, atomically. */
export async function updatePurchase(id: string, input: PurchaseInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.purchase.findUnique({ where: { id }, include: { labours: true } });
    if (!existing) throw notFound('Purchase');
    await assertReferences(tx, input, { partyId: existing.partyId, labourIds: existing.labours.map((l) => l.labourId) });
    await unpostPurchase(tx, id);
    await tx.purchaseLabour.deleteMany({ where: { purchaseId: id } });
    await tx.purchase.update({ where: { id }, data: { ...toData(input), labours: { create: labourRows(input) } } });
    await postPurchase(tx, id);
    return tx.purchase.findUniqueOrThrow({ where: { id }, include: purchaseInclude });
  });
}

export async function deletePurchase(id: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.purchase.findUnique({ where: { id } });
    if (!existing) throw notFound('Purchase');
    await unpostPurchase(tx, id);
    await tx.purchaseLabour.deleteMany({ where: { purchaseId: id } });
    await tx.purchase.delete({ where: { id } });
  });
}
