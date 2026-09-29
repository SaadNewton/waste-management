import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';
import { dateRange } from '../../lib/dates';
import { num } from '../../lib/money';
import { formatPurchaseNo, peekSerial } from '../../lib/posting';
import { adminOnly } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParam, pageMeta, paginate } from '../../lib/validation';
import { purchaseListQuery, purchaseSchema, type PurchaseInput } from './purchases.schema';
import { createPurchase, deletePurchase, purchaseInclude, updatePurchase } from './purchases.service';

const router = Router();

router.get('/', validate({ query: purchaseListQuery }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof purchaseListQuery>;
  const where: Prisma.PurchaseWhereInput = {
    date: dateRange(q.from, q.to),
    ...(q.partyId ? { partyId: q.partyId } : {}),
    ...(q.vehicleNo ? { vehicleNo: { contains: q.vehicleNo, mode: 'insensitive' } } : {}),
    ...(q.q
      ? {
          OR: [
            { purchaseNo: { contains: q.q, mode: 'insensitive' } },
            { vehicleNo: { contains: q.q, mode: 'insensitive' } },
            { driverName: { contains: q.q, mode: 'insensitive' } },
            { material: { contains: q.q, mode: 'insensitive' } },
            { party: { name: { contains: q.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [data, total, sums] = await Promise.all([
    prisma.purchase.findMany({
      where,
      orderBy: [{ [q.sortBy]: q.sortOrder }, { serialNo: q.sortOrder }],
      ...paginate(q.page, q.pageSize),
      include: { party: { select: { id: true, name: true } }, _count: { select: { labours: true } } },
    }),
    prisma.purchase.count({ where }),
    prisma.purchase.aggregate({
      where,
      _sum: { netWeight: true, amount: true, truckRent: true, labourCost: true, amountPaid: true, grandTotal: true, partyPayable: true },
    }),
  ]);
  const totals = Object.fromEntries(Object.entries(sums._sum).map(([k, v]) => [k, num(v)]));
  res.json({ data, meta: pageMeta(q.page, q.pageSize, total), totals: { count: total, ...totals } });
});

/** Preview of the next slip number (the real one is assigned on save). */
router.get('/next-number', async (_req, res) => {
  res.json({ purchaseNo: formatPurchaseNo(await peekSerial('purchase')) });
});

router.get('/:id', validate({ params: idParam }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const purchase = await prisma.purchase.findUnique({ where: { id }, include: purchaseInclude });
  if (!purchase) throw notFound('Purchase');
  res.json(purchase);
});

router.post('/', validate({ body: purchaseSchema }), async (req, res) => {
  res.status(201).json(await createPurchase(res.locals.body as PurchaseInput, req.user!.id));
});

router.put('/:id', validate({ params: idParam, body: purchaseSchema }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  res.json(await updatePurchase(id, res.locals.body as PurchaseInput));
});

router.delete('/:id', adminOnly, validate({ params: idParam }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  await deletePurchase(id);
  res.json({ ok: true });
});

export default router;
