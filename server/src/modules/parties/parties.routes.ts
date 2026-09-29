import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';
import { partyBalances } from '../../lib/balances';
import { dateRange } from '../../lib/dates';
import { num, round2 } from '../../lib/money';
import { adminOnly } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParam, listQuery, pageMeta, paginate } from '../../lib/validation';
import { partyListQuery, partySchema, type PartyInput } from './parties.schema';

const router = Router();

router.get('/', validate({ query: partyListQuery }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof partyListQuery>;
  const where: Prisma.PartyWhereInput = {
    ...(q.includeDeleted ? {} : { deletedAt: { isSet: false } }),
    ...(q.status === 'all' ? {} : { isActive: q.status === 'active' }),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: 'insensitive' } },
            { phone: { contains: q.q } },
            { cnic: { contains: q.q } },
            { address: { contains: q.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [parties, total] = await Promise.all([
    prisma.party.findMany({
      where,
      orderBy: { [q.sortBy]: q.sortOrder },
      ...paginate(q.page, q.pageSize),
      include: { _count: { select: { purchases: true } } },
    }),
    prisma.party.count({ where }),
  ]);
  const balances = await partyBalances(parties.map((p) => p.id));
  const data = parties.map(({ _count, ...p }) => ({
    ...p,
    purchaseCount: _count.purchases,
    balance: balances.get(p.id)?.balance ?? 0,
  }));
  res.json({ data, meta: pageMeta(q.page, q.pageSize, total) });
});

/** Lightweight list for dropdowns. `includeId` keeps an inactive party selectable when editing. */
router.get('/options', async (req, res) => {
  const includeId = /^[a-f\d]{24}$/i.test(String(req.query.includeId)) ? String(req.query.includeId) : undefined;
  const data = await prisma.party.findMany({
    where: { OR: [{ isActive: true, deletedAt: { isSet: false } }, ...(includeId ? [{ id: includeId }] : [])] },
    select: { id: true, name: true, phone: true },
    orderBy: { name: 'asc' },
  });
  res.json(data);
});

router.get('/:id', validate({ params: idParam }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const party = await prisma.party.findUnique({ where: { id } });
  if (!party) throw notFound('Party');
  const [balance, agg, payments] = await Promise.all([
    partyBalances([id]),
    prisma.purchase.aggregate({
      where: { partyId: id },
      _count: true,
      _sum: { netWeight: true, amount: true, amountPaid: true },
    }),
    prisma.payment.aggregate({ where: { partyId: id, direction: 'OUT' }, _sum: { amount: true } }),
  ]);
  const b = balance.get(id)!;
  res.json({
    ...party,
    balance: b.balance,
    stats: {
      purchases: agg._count,
      totalWeight: num(agg._sum.netWeight),
      totalAmount: num(agg._sum.amount),
      totalPaid: round2(b.debit),
      paidAtPurchase: num(agg._sum.amountPaid),
      paidByVoucher: num(payments._sum.amount),
    },
  });
});

const historyQuery = listQuery(['date', 'netWeight', 'amount'], 'date');

router.get('/:id/purchases', validate({ params: idParam, query: historyQuery }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const q = res.locals.query as z.infer<typeof historyQuery>;
  const where: Prisma.PurchaseWhereInput = { partyId: id, date: dateRange(q.from, q.to) };
  const [data, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      orderBy: [{ [q.sortBy]: q.sortOrder }, { createdAt: 'desc' }],
      ...paginate(q.page, q.pageSize),
      select: {
        id: true, purchaseNo: true, date: true, vehicleNo: true, material: true, netWeight: true,
        rate: true, amount: true, amountPaid: true, partyPayable: true,
      },
    }),
    prisma.purchase.count({ where }),
  ]);
  res.json({ data, meta: pageMeta(q.page, q.pageSize, total) });
});

router.post('/', validate({ body: partySchema }), async (_req, res) => {
  const body = res.locals.body as PartyInput;
  res.status(201).json(await prisma.party.create({ data: body }));
});

router.put('/:id', validate({ params: idParam, body: partySchema }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const body = res.locals.body as PartyInput;
  res.json(await prisma.party.update({ where: { id }, data: body }));
});

/** Parties with transactions are soft-deleted to keep ledgers intact. */
router.delete('/:id', adminOnly, validate({ params: idParam }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const party = await prisma.party.findUnique({ where: { id } });
  if (!party) throw notFound('Party');
  const [purchases, payments] = await Promise.all([
    prisma.purchase.count({ where: { partyId: id } }),
    prisma.payment.count({ where: { partyId: id } }),
  ]);
  if (purchases + payments > 0) {
    await prisma.party.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    res.json({ ok: true, softDeleted: true });
    return;
  }
  await prisma.party.delete({ where: { id } });
  res.json({ ok: true, softDeleted: false });
});

router.post('/:id/restore', adminOnly, validate({ params: idParam }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  res.json(await prisma.party.update({ where: { id }, data: { deletedAt: { unset: true }, isActive: true } }));
});

export default router;
