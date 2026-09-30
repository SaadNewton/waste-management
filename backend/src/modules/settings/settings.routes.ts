import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { adminOnly } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { money, optionalText } from '../../lib/validation';

const router = Router();

export const getSettings = () => prisma.setting.upsert({ where: { key: 'default' }, update: {}, create: { key: 'default' } });

router.get('/', async (_req, res) => {
  res.json(await getSettings());
});

const settingsSchema = z.object({
  businessName: z.string().trim().min(1).max(120),
  address: optionalText,
  phone: optionalText,
  currency: z.string().trim().min(1).max(10),
  openingCash: money,
  openingBank: money,
});

router.put('/', adminOnly, validate({ body: settingsSchema }), async (_req, res) => {
  const body = res.locals.body as z.infer<typeof settingsSchema>;
  res.json(await prisma.setting.upsert({ where: { key: 'default' }, update: body, create: { key: 'default', ...body } }));
});

export default router;
