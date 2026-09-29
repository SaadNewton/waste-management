import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { badRequest, unauthorized } from '../../lib/errors';
import { requireAuth, signToken } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

const router = Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
});

router.post('/login', validate({ body: loginSchema }), async (_req, res) => {
  const { email, password } = res.locals.body as z.infer<typeof loginSchema>;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('Invalid email or password');
  }
  const authUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: signToken(authUser), user: authUser });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

router.post('/change-password', requireAuth, validate({ body: changePasswordSchema }), async (req, res) => {
  const { currentPassword, newPassword } = res.locals.body as z.infer<typeof changePasswordSchema>;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw badRequest('Current password is incorrect');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  res.json({ ok: true });
});

export default router;
