import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { badRequest, notFound } from '../../lib/errors';
import { adminOnly } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParam, listQuery, pageMeta, paginate } from '../../lib/validation';

const router = Router();
router.use(adminOnly);

const select = { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } as const;

const query = listQuery(['name', 'email', 'createdAt'], 'name');

router.get('/', validate({ query }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof query>;
  const where = q.q
    ? { OR: [{ name: { contains: q.q, mode: 'insensitive' as const } }, { email: { contains: q.q, mode: 'insensitive' as const } }] }
    : {};
  const [data, total] = await Promise.all([
    prisma.user.findMany({ where, select, orderBy: { [q.sortBy]: q.sortOrder }, ...paginate(q.page, q.pageSize) }),
    prisma.user.count({ where }),
  ]);
  res.json({ data, meta: pageMeta(q.page, q.pageSize, total) });
});

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'STAFF']).default('STAFF'),
  isActive: z.boolean().default(true),
});
const updateSchema = createSchema.extend({ password: z.string().min(6).optional().or(z.literal('')) });

router.post('/', validate({ body: createSchema }), async (_req, res) => {
  const { password, ...body } = res.locals.body as z.infer<typeof createSchema>;
  const user = await prisma.user.create({ data: { ...body, passwordHash: await bcrypt.hash(password, 10) }, select });
  res.status(201).json(user);
});

router.put('/:id', validate({ params: idParam, body: updateSchema }), async (req, res) => {
  const { id } = res.locals.params as { id: string };
  const { password, ...body } = res.locals.body as z.infer<typeof updateSchema>;
  if (id === req.user!.id && (!body.isActive || body.role !== 'ADMIN')) {
    throw badRequest('You cannot deactivate or demote your own account');
  }
  const user = await prisma.user.update({
    where: { id },
    data: { ...body, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
    select,
  });
  res.json(user);
});

router.delete('/:id', validate({ params: idParam }), async (req, res) => {
  const { id } = res.locals.params as { id: string };
  if (id === req.user!.id) throw badRequest('You cannot delete your own account');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('User');
  // Users referenced by documents are deactivated instead of deleted.
  const [p, e, pay] = await Promise.all([
    prisma.purchase.count({ where: { createdById: id } }),
    prisma.expense.count({ where: { createdById: id } }),
    prisma.payment.count({ where: { createdById: id } }),
  ]);
  if (p + e + pay > 0) {
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    res.json({ ok: true, softDeleted: true });
    return;
  }
  await prisma.user.delete({ where: { id } });
  res.json({ ok: true, softDeleted: false });
});

export default router;
