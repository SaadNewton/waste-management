import { z } from 'zod';
import { listQuery, money, optionalText } from '../../lib/validation';

export const partySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  phone: optionalText,
  address: optionalText,
  cnic: optionalText,
  openingBalance: money.default(0),
  openingType: z.enum(['DR', 'CR']).default('CR'),
  notes: optionalText,
  isActive: z.boolean().default(true),
});
export type PartyInput = z.infer<typeof partySchema>;

export const partyListQuery = listQuery(['name', 'createdAt', 'openingBalance'], 'name');
