import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { labourBalances, partyBalances } from '../../lib/balances';
import { addDays, dateRange, fromDbDate, monthStart, todayString } from '../../lib/dates';
import { num, round2 } from '../../lib/money';
import { bookBalanceBefore } from '../daybook/daybook.routes';

const router = Router();

async function periodTotals(from: string, to: string) {
  const date = dateRange(from, to);
  const [purchases, rent, expenses] = await Promise.all([
    prisma.purchase.aggregate({ where: { date }, _count: true, _sum: { netWeight: true, amount: true, labourCost: true } }),
    prisma.purchase.aggregate({ where: { date, truckRentPaidBy: { not: 'PARTY' } }, _sum: { truckRent: true } }),
    prisma.expense.aggregate({ where: { date }, _sum: { amount: true } }),
  ]);
  return {
    trucks: purchases._count,
    weight: num(purchases._sum.netWeight),
    purchaseAmount: num(purchases._sum.amount),
    labourCost: num(purchases._sum.labourCost),
    truckRent: num(rent._sum.truckRent),
    expenses: num(expenses._sum.amount),
  };
}

async function topParties(where: Prisma.PurchaseWhereInput, orderBy: 'amount' | 'netWeight') {
  const rows = await prisma.purchase.groupBy({
    by: ['partyId'],
    where,
    _sum: { netWeight: true, amount: true },
    _count: true,
    orderBy: { _sum: { [orderBy]: 'desc' } },
    take: 5,
  });
  const parties = await prisma.party.findMany({ where: { id: { in: rows.map((r) => r.partyId) } }, select: { id: true, name: true } });
  return rows.map((r) => ({
    partyId: r.partyId,
    name: parties.find((p) => p.id === r.partyId)?.name ?? '—',
    trucks: r._count,
    weight: num(r._sum.netWeight),
    amount: num(r._sum.amount),
  }));
}

router.get('/', async (_req, res) => {
  const today = todayString();
  const month = monthStart(today);
  const chartFrom = addDays(today, -29);
  const tomorrow = addDays(today, 1);

  const [todayTotals, monthTotals, byAmount, byWeight, pBal, lBal, daily, cashInHand, bankBalance, recent] = await Promise.all([
    periodTotals(today, today),
    periodTotals(month, today),
    topParties({ date: dateRange(month, today) }, 'amount'),
    topParties({ date: dateRange(month, today) }, 'netWeight'),
    partyBalances(),
    labourBalances(),
    prisma.purchase.groupBy({
      by: ['date'],
      where: { date: dateRange(chartFrom, today) },
      _sum: { amount: true, netWeight: true },
      _count: true,
    }),
    bookBalanceBefore('CASH', tomorrow),
    bookBalanceBefore('BANK', tomorrow),
    prisma.purchase.findMany({
      orderBy: [{ date: 'desc' }, { serialNo: 'desc' }],
      take: 6,
      select: { id: true, purchaseNo: true, date: true, vehicleNo: true, netWeight: true, amount: true, party: { select: { name: true } } },
    }),
  ]);

  const sumBalances = (values: number[]) => ({
    payable: round2(values.filter((v) => v > 0).reduce((s, v) => s + v, 0)),
    advance: round2(values.filter((v) => v < 0).reduce((s, v) => s - v, 0)),
  });

  const chart: { date: string; amount: number; weight: number; trucks: number }[] = [];
  for (let d = chartFrom; d <= today; d = addDays(d, 1)) {
    const row = daily.find((r) => fromDbDate(r.date) === d);
    chart.push({ date: d, amount: num(row?._sum.amount), weight: num(row?._sum.netWeight), trucks: row?._count ?? 0 });
  }

  res.json({
    today,
    todayTotals,
    monthTotals,
    topPartiesByAmount: byAmount,
    topPartiesByWeight: byWeight,
    payables: {
      parties: sumBalances([...pBal.values()].map((b) => b.balance)),
      labour: sumBalances([...lBal.values()].map((b) => b.balance)),
    },
    cashInHand,
    bankBalance,
    chart,
    recent,
  });
});

export default router;
