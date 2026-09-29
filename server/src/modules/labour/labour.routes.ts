import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';
import { labourBalances } from '../../lib/balances';
import { dateRange } from '../../lib/dates';
import { adminOnly } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParam, listQuery, money, optionalText, pageMeta, paginate } from '../../lib/validation';

const router = Router();

const labourSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  phone: optionalText,
  address: optionalText,
  defaultWage: money.optional().nullable(),
  isActive: z.boolean().default(true),
});
type LabourInput = z.infer<typeof labourSchema>;

const labourListQuery = listQuery(['name', 'createdAt', 'defaultWage'], 'name');

router.get('/', validate({ query: labourListQuery }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof labourListQuery>;
  const where: Prisma.LabourWhereInput = {
    ...(q.includeDeleted ? {} : { deletedAt: { isSet: false } }),
    ...(q.status === 'all' ? {} : { isActive: q.status === 'active' }),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: 'insensitive' } },
            { phone: { contains: q.q } },
            { address: { contains: q.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [labour, total] = await Promise.all([
    prisma.labour.findMany({
      where,
      orderBy: { [q.sortBy]: q.sortOrder },
      ...paginate(q.page, q.pageSize),
      include: { _count: { select: { work: true } } },
    }),
    prisma.labour.count({ where }),
  ]);
  const balances = await labourBalances(labour.map((l) => l.id));
  const data = labour.map(({ _count, ...l }) => ({
    ...l,
    jobs: _count.work,
    ...(balances.get(l.id) ?? { earned: 0, paid: 0, balance: 0 }),
  }));
  res.json({ data, meta: pageMeta(q.page, q.pageSize, total) });
});

router.get('/options', async (req, res) => {
  const includeIds = String(req.query.includeIds ?? '')
    .split(',')
    .filter((id) => /^[a-f\d]{24}$/i.test(id));
  const data = await prisma.labour.findMany({
    where: { OR: [{ isActive: true, deletedAt: { isSet: false } }, ...(includeIds.length ? [{ id: { in: includeIds } }] : [])] },
    select: { id: true, name: true, defaultWage: true },
    orderBy: { name: 'asc' },
  });
  res.json(data);
});

router.get('/:id', validate({ params: idParam }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const labour = await prisma.labour.findUnique({ where: { id } });
  if (!labour) throw notFound('Labour');
  const [balances, jobs] = await Promise.all([labourBalances([id]), prisma.purchaseLabour.count({ where: { labourId: id } })]);
  res.json({ ...labour, jobs, ...(balances.get(id) ?? { earned: 0, paid: 0, balance: 0 }) });
});

const workQuery = listQuery(['date'], 'date');

/** Trucks this labourer offloaded. */
router.get('/:id/work', validate({ params: idParam, query: workQuery }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const q = res.locals.query as z.infer<typeof workQuery>;
  const where: Prisma.PurchaseLabourWhereInput = { labourId: id, purchase: { date: dateRange(q.from, q.to) } };
  const [rows, total] = await Promise.all([
    prisma.purchaseLabour.findMany({
      where,
      orderBy: [{ purchase: { date: q.sortOrder } }, { createdAt: q.sortOrder }],
      ...paginate(q.page, q.pageSize),
      include: {
        purchase: {
          select: { id: true, purchaseNo: true, date: true, vehicleNo: true, netWeight: true, party: { select: { name: true } } },
        },
      },
    }),
    prisma.purchaseLabour.count({ where }),
  ]);
  const data = rows.map((r) => ({
    id: r.id,
    wage: r.wage,
    paid: r.paid,
    purchaseId: r.purchase.id,
    purchaseNo: r.purchase.purchaseNo,
    date: r.purchase.date,
    vehicleNo: r.purchase.vehicleNo,
    netWeight: r.purchase.netWeight,
    partyName: r.purchase.party.name,
  }));
  res.json({ data, meta: pageMeta(q.page, q.pageSize, total) });
});

router.post('/', validate({ body: labourSchema }), async (_req, res) => {
  res.status(201).json(await prisma.labour.create({ data: res.locals.body as LabourInput }));
});

router.put('/:id', validate({ params: idParam, body: labourSchema }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  res.json(await prisma.labour.update({ where: { id }, data: res.locals.body as LabourInput }));
});

router.delete('/:id', adminOnly, validate({ params: idParam }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const labour = await prisma.labour.findUnique({ where: { id } });
  if (!labour) throw notFound('Labour');
  const [work, payments] = await Promise.all([
    prisma.purchaseLabour.count({ where: { labourId: id } }),
    prisma.payment.count({ where: { labourId: id } }),
  ]);
  if (work + payments > 0) {
    await prisma.labour.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    res.json({ ok: true, softDeleted: true });
    return;
  }
  await prisma.labour.delete({ where: { id } });
  res.json({ ok: true, softDeleted: false });
});

router.post('/:id/restore', adminOnly, validate({ params: idParam }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  res.json(await prisma.labour.update({ where: { id }, data: { deletedAt: { unset: true }, isActive: true } }));
});

export default router;
