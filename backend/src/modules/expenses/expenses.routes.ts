import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { badRequest, notFound } from '../../lib/errors';
import { dateRange, toDbDate } from '../../lib/dates';
import { num } from '../../lib/money';
import { postExpense, unpostExpense } from '../../lib/posting';
import { adminOnly } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { dateString, idParam, listQuery, optionalText, pageMeta, paginate, positiveMoney, objectId } from '../../lib/validation';

const router = Router();

const expenseSchema = z.object({
  date: dateString,
  categoryId: objectId('Category is required'),
  amount: positiveMoney,
  paymentMethod: z.enum(['CASH', 'BANK']).default('CASH'),
  paidTo: optionalText,
  description: optionalText,
});
type ExpenseInput = z.infer<typeof expenseSchema>;

const query = listQuery(['date', 'amount', 'createdAt'], 'date').extend({
  categoryId: objectId().optional(),
  paymentMethod: z.enum(['CASH', 'BANK']).optional(),
});

const include = { category: { select: { id: true, name: true } } } as const;

router.get('/', validate({ query }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof query>;
  const where: Prisma.ExpenseWhereInput = {
    date: dateRange(q.from, q.to),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.paymentMethod ? { paymentMethod: q.paymentMethod } : {}),
    ...(q.q
      ? {
          OR: [
            { paidTo: { contains: q.q, mode: 'insensitive' } },
            { description: { contains: q.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [data, total, sum, byCategory] = await Promise.all([
    prisma.expense.findMany({
      where,
      include,
      orderBy: [{ [q.sortBy]: q.sortOrder }, { createdAt: q.sortOrder }],
      ...paginate(q.page, q.pageSize),
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
    prisma.expense.groupBy({ by: ['categoryId'], where, _sum: { amount: true } }),
  ]);
  const categories = await prisma.expenseCategory.findMany({ where: { id: { in: byCategory.map((b) => b.categoryId) } } });
  res.json({
    data,
    meta: pageMeta(q.page, q.pageSize, total),
    totals: {
      count: total,
      amount: num(sum._sum.amount),
      byCategory: byCategory
        .map((b) => ({
          categoryId: b.categoryId,
          name: categories.find((c) => c.id === b.categoryId)?.name ?? '—',
          amount: num(b._sum.amount),
        }))
        .sort((a, b) => b.amount - a.amount),
    },
  });
});

router.get('/:id', validate({ params: idParam }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const expense = await prisma.expense.findUnique({ where: { id }, include });
  if (!expense) throw notFound('Expense');
  res.json(expense);
});

async function assertCategory(id: string, currentId?: string) {
  const cat = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!cat) throw badRequest('Category does not exist');
  if (!cat.isActive && cat.id !== currentId) throw badRequest('Category is inactive');
}

router.post('/', validate({ body: expenseSchema }), async (req, res) => {
  const body = res.locals.body as ExpenseInput;
  await assertCategory(body.categoryId);
  const expense = await prisma.$transaction(async (tx) => {
    const e = await tx.expense.create({ data: { ...body, date: toDbDate(body.date), createdById: req.user!.id } });
    await postExpense(tx, e.id);
    return tx.expense.findUniqueOrThrow({ where: { id: e.id }, include });
  });
  res.status(201).json(expense);
});

router.put('/:id', validate({ params: idParam, body: expenseSchema }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const body = res.locals.body as ExpenseInput;
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) throw notFound('Expense');
  await assertCategory(body.categoryId, existing.categoryId);
  const expense = await prisma.$transaction(async (tx) => {
    await unpostExpense(tx, id);
    await tx.expense.update({ where: { id }, data: { ...body, date: toDbDate(body.date) } });
    await postExpense(tx, id);
    return tx.expense.findUniqueOrThrow({ where: { id }, include });
  });
  res.json(expense);
});

router.delete('/:id', adminOnly, validate({ params: idParam }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  await prisma.$transaction(async (tx) => {
    await unpostExpense(tx, id);
    await tx.expense.delete({ where: { id } });
  });
  res.json({ ok: true });
});

export default router;
