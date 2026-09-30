import { Router } from 'express';
import type { PaymentMethod } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { badRequest } from '../../lib/errors';
import { addDays, dateRange, fromDbDate, toDbDate, todayString } from '../../lib/dates';
import { num, round2 } from '../../lib/money';
import { validate } from '../../middleware/validate';
import { dateString } from '../../lib/validation';
import { getSettings } from '../settings/settings.routes';

const router = Router();

/** Balance of a cash/bank account at the start of `date` (settings opening + all movements before it). */
export async function bookBalanceBefore(method: PaymentMethod, date: string) {
  const [settings, sums] = await Promise.all([
    getSettings(),
    prisma.cashEntry.groupBy({ by: ['direction'], where: { method, date: { lt: toDbDate(date) } }, _sum: { amount: true } }),
  ]);
  const opening = num(method === 'CASH' ? settings.openingCash : settings.openingBank);
  const cashIn = num(sums.find((s) => s.direction === 'IN')?._sum.amount);
  const cashOut = num(sums.find((s) => s.direction === 'OUT')?._sum.amount);
  return round2(opening + cashIn - cashOut);
}

const query = z.object({ from: dateString.optional(), to: dateString.optional() });

router.get('/', validate({ query }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof query>;
  const from = q.from ?? q.to ?? todayString();
  const to = q.to ?? from;
  if (to < from) throw badRequest('"to" must be on or after "from"');
  if (toDbDate(to).getTime() - toDbDate(from).getTime() > 366 * 86_400_000) throw badRequest('Date range cannot exceed one year');

  const range = dateRange(from, to);
  const [cashOpening, bankOpening, entries, purchases] = await Promise.all([
    bookBalanceBefore('CASH', from),
    bookBalanceBefore('BANK', from),
    prisma.cashEntry.findMany({ where: { date: range }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { seq: 'asc' }] }),
    prisma.purchase.findMany({
      where: { date: range },
      orderBy: [{ date: 'asc' }, { serialNo: 'asc' }],
      select: {
        id: true, purchaseNo: true, date: true, vehicleNo: true, material: true, netWeight: true, rate: true,
        amount: true, truckRent: true, truckRentPaidBy: true, labourCost: true, amountPaid: true, partyPayable: true,
        party: { select: { id: true, name: true } },
      },
    }),
  ]);

  const book = (method: PaymentMethod, opening: number) => {
    const rows = entries.filter((e) => e.method === method);
    const cashIn = round2(rows.filter((e) => e.direction === 'IN').reduce((s, e) => s + num(e.amount), 0));
    const cashOut = round2(rows.filter((e) => e.direction === 'OUT').reduce((s, e) => s + num(e.amount), 0));
    return { opening, in: cashIn, out: cashOut, closing: round2(opening + cashIn - cashOut) };
  };

  // Day-by-day cash roll-forward: each day's closing is the next day's opening.
  const days: { date: string; opening: number; in: number; out: number; closing: number }[] = [];
  let running = cashOpening;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const dayRows = entries.filter((e) => e.method === 'CASH' && fromDbDate(e.date) === d);
    const cashIn = round2(dayRows.filter((e) => e.direction === 'IN').reduce((s, e) => s + num(e.amount), 0));
    const cashOut = round2(dayRows.filter((e) => e.direction === 'OUT').reduce((s, e) => s + num(e.amount), 0));
    const closing = round2(running + cashIn - cashOut);
    days.push({ date: d, opening: running, in: cashIn, out: cashOut, closing });
    running = closing;
  }

  const categories = new Map<string, { category: string; in: number; out: number }>();
  for (const e of entries) {
    const c = categories.get(e.category) ?? { category: e.category, in: 0, out: 0 };
    if (e.direction === 'IN') c.in = round2(c.in + num(e.amount));
    else c.out = round2(c.out + num(e.amount));
    categories.set(e.category, c);
  }

  const sum = (key: 'netWeight' | 'amount' | 'truckRent' | 'labourCost' | 'amountPaid' | 'partyPayable') =>
    round2(purchases.reduce((s, p) => s + num(p[key]), 0));

  res.json({
    from,
    to,
    cash: book('CASH', cashOpening),
    bank: book('BANK', bankOpening),
    days,
    transactions: entries.map((e) => ({ ...e, date: fromDbDate(e.date) })),
    byCategory: [...categories.values()],
    purchases: purchases.map((p) => ({ ...p, date: fromDbDate(p.date) })),
    purchaseTotals: {
      count: purchases.length,
      netWeight: sum('netWeight'),
      amount: sum('amount'),
      truckRent: sum('truckRent'),
      labourCost: sum('labourCost'),
      amountPaid: sum('amountPaid'),
      partyPayable: sum('partyPayable'),
    },
  });
});

export default router;
