import { z } from 'zod';
import { isDateString } from './dates';

export const dateString = z.string().refine(isDateString, 'Invalid date (expected YYYY-MM-DD)');

export const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const money = z.coerce.number().finite().min(0, 'Must be 0 or more').max(999_999_999_999);
export const positiveMoney = z.coerce.number().finite().positive('Must be greater than 0').max(999_999_999_999);

/** A MongoDB ObjectId as a 24-char hex string. Empty strings are treated as missing. */
export const objectId = (message = 'Invalid id') =>
  z.string({ required_error: message, invalid_type_error: message }).trim().regex(/^[a-f\d]{24}$/i, message);

export const idParam = z.object({ id: objectId() });

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

/** Common list query: pagination, sorting, search and date range. */
export function listQuery<const S extends readonly [string, ...string[]]>(sortFields: S, defaultSort: S[number]) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(500).default(20),
    sortBy: z.enum(sortFields).default(defaultSort as S[number]),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    q: z.string().trim().optional(),
    from: dateString.optional(),
    to: dateString.optional(),
    status: z.enum(['active', 'inactive', 'all']).default('all'),
    includeDeleted: booleanish.optional(),
  });
}

export function paginate(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function pageMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
