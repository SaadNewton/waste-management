import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma, type Tx } from '../../lib/prisma';
import { badRequest, notFound } from '../../lib/errors';
import { dateRange, toDbDate } from '../../lib/dates';
import { num } from '../../lib/money';
import { formatVoucherNo, nextSerial, postPayment, unpostPayment } from '../../lib/posting';
import { adminOnly } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { dateString, idParam, listQuery, optionalText, pageMeta, paginate, positiveMoney, objectId } from '../../lib/validation';

const router = Router();

const paymentSchema = z
  .object({
    date: dateString,
    payeeType: z.enum(['PARTY', 'LABOUR', 'OTHER']),
    direction: z.enum(['OUT', 'IN']).default('OUT'),
    partyId: objectId().optional().nullable(),
    labourId: objectId().optional().nullable(),
    payeeName: optionalText,
    amount: positiveMoney,
    method: z.enum(['CASH', 'BANK']).default('CASH'),
    note: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.payeeType === 'PARTY' && !v.partyId) ctx.addIssue({ code: 'custom', path: ['partyId'], message: 'Select a party' });
    if (v.payeeType === 'LABOUR' && !v.labourId) ctx.addIssue({ code: 'custom', path: ['labourId'], message: 'Select a labourer' });
    if (v.payeeType === 'OTHER' && !v.payeeName) ctx.addIssue({ code: 'custom', path: ['payeeName'], message: 'Enter a name' });
  })
  .transform((v) => ({
    ...v,
    partyId: v.payeeType === 'PARTY' ? v.partyId! : null,
    labourId: v.payeeType === 'LABOUR' ? v.labourId! : null,
    payeeName: v.payeeType === 'OTHER' ? v.payeeName : null,
  }));
type PaymentInput = z.infer<typeof paymentSchema>;

const query = listQuery(['date', 'amount', 'serialNo', 'createdAt'], 'date').extend({
  payeeType: z.enum(['PARTY', 'LABOUR', 'OTHER']).optional(),
  direction: z.enum(['OUT', 'IN']).optional(),
  partyId: objectId().optional(),
  labourId: objectId().optional(),
  method: z.enum(['CASH', 'BANK']).optional(),
});

const include = {
  party: { select: { id: true, name: true } },
  labour: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

router.get('/', validate({ query }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof query>;
  const where: Prisma.PaymentWhereInput = {
    date: dateRange(q.from, q.to),
    ...(q.payeeType ? { payeeType: q.payeeType } : {}),
    ...(q.direction ? { direction: q.direction } : {}),
    ...(q.partyId ? { partyId: q.partyId } : {}),
    ...(q.labourId ? { labourId: q.labourId } : {}),
    ...(q.method ? { method: q.method } : {}),
    ...(q.q
      ? {
          OR: [
            { voucherNo: { contains: q.q, mode: 'insensitive' } },
            { payeeName: { contains: q.q, mode: 'insensitive' } },
            { note: { contains: q.q, mode: 'insensitive' } },
            { party: { name: { contains: q.q, mode: 'insensitive' } } },
            { labour: { name: { contains: q.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [data, total, sums] = await Promise.all([
    prisma.payment.findMany({ where, include, orderBy: [{ [q.sortBy]: q.sortOrder }, { createdAt: q.sortOrder }], ...paginate(q.page, q.pageSize) }),
    prisma.payment.count({ where }),
    prisma.payment.groupBy({ by: ['direction'], where, _sum: { amount: true } }),
  ]);
  const paidOut = num(sums.find((s) => s.direction === 'OUT')?._sum.amount);
  const received = num(sums.find((s) => s.direction === 'IN')?._sum.amount);
  res.json({ data, meta: pageMeta(q.page, q.pageSize, total), totals: { count: total, paidOut, received } });
});

router.get('/:id', validate({ params: idParam }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const payment = await prisma.payment.findUnique({ where: { id }, include });
  if (!payment) throw notFound('Payment');
  res.json(payment);
});

async function assertPayee(tx: Tx, input: PaymentInput, existing?: { partyId: string | null; labourId: string | null }) {
  if (input.partyId) {
    const p = await tx.party.findUnique({ where: { id: input.partyId } });
    if (!p) throw badRequest('Party does not exist');
    if (p.deletedAt && existing?.partyId !== p.id) throw badRequest('Party has been deleted');
  }
  if (input.labourId) {
    const l = await tx.labour.findUnique({ where: { id: input.labourId } });
    if (!l) throw badRequest('Labour does not exist');
    if (l.deletedAt && existing?.labourId !== l.id) throw badRequest('Labour has been deleted');
  }
}

router.post('/', validate({ body: paymentSchema }), async (req, res) => {
  const body = res.locals.body as PaymentInput;
  const payment = await prisma.$transaction(async (tx) => {
    await assertPayee(tx, body);
    const serialNo = await nextSerial(tx, 'payment');
    const p = await tx.payment.create({
      data: { ...body, date: toDbDate(body.date), serialNo, voucherNo: formatVoucherNo(serialNo), createdById: req.user!.id },
    });
    await postPayment(tx, p.id);
    return tx.payment.findUniqueOrThrow({ where: { id: p.id }, include });
  });
  res.status(201).json(payment);
});

router.put('/:id', validate({ params: idParam, body: paymentSchema }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const body = res.locals.body as PaymentInput;
  const payment = await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({ where: { id } });
    if (!existing) throw notFound('Payment');
    await assertPayee(tx, body, existing);
    await unpostPayment(tx, id);
    await tx.payment.update({ where: { id }, data: { ...body, date: toDbDate(body.date) } });
    await postPayment(tx, id);
    return tx.payment.findUniqueOrThrow({ where: { id }, include });
  });
  res.json(payment);
});

router.delete('/:id', adminOnly, validate({ params: idParam }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  await prisma.$transaction(async (tx) => {
    await unpostPayment(tx, id);
    await tx.payment.delete({ where: { id } });
  });
  res.json({ ok: true });
});

export default router;
