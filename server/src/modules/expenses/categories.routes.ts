import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { conflict, notFound } from '../../lib/errors';
import { adminOnly } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParam, listQuery, optionalText, pageMeta, paginate } from '../../lib/validation';

const router = Router();

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  description: optionalText,
  isActive: z.boolean().default(true),
});

const query = listQuery(['name', 'createdAt'], 'name');

router.get('/', validate({ query }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof query>;
  const where: Prisma.ExpenseCategoryWhereInput = {
    ...(q.status === 'all' ? {} : { isActive: q.status === 'active' }),
    ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.expenseCategory.findMany({
      where,
      orderBy: { [q.sortBy]: q.sortOrder },
      ...paginate(q.page, q.pageSize),
      include: { _count: { select: { expenses: true } } },
    }),
    prisma.expenseCategory.count({ where }),
  ]);
  res.json({ data: data.map(({ _count, ...c }) => ({ ...c, expenseCount: _count.expenses })), meta: pageMeta(q.page, q.pageSize, total) });
});

router.get('/options', async (_req, res) => {
  res.json(await prisma.expenseCategory.findMany({ select: { id: true, name: true, isActive: true }, orderBy: { name: 'asc' } }));
});

router.post('/', validate({ body: categorySchema }), async (_req, res) => {
  res.status(201).json(await prisma.expenseCategory.create({ data: res.locals.body }));
});

router.put('/:id', validate({ params: idParam, body: categorySchema }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  res.json(await prisma.expenseCategory.update({ where: { id }, data: res.locals.body }));
});

router.delete('/:id', adminOnly, validate({ params: idParam }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const cat = await prisma.expenseCategory.findUnique({ where: { id }, include: { _count: { select: { expenses: true } } } });
  if (!cat) throw notFound('Category');
  if (cat._count.expenses > 0) throw conflict('This category has expenses. Mark it inactive instead.');
  await prisma.expenseCategory.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
