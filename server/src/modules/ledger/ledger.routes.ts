import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';
import { labourBalances, ledgerStatement, partyBalances } from '../../lib/balances';
import { round2 } from '../../lib/money';
import { validate } from '../../middleware/validate';
import { dateString, idParam, pageMeta } from '../../lib/validation';

const router = Router();

const rangeQuery = z.object({ from: dateString.optional(), to: dateString.optional() });

router.get('/party/:id', validate({ params: idParam, query: rangeQuery }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const { from, to } = res.locals.query as z.infer<typeof rangeQuery>;
  const party = await prisma.party.findUnique({ where: { id }, select: { id: true, name: true, phone: true, address: true } });
  if (!party) throw notFound('Party');
  res.json({ account: party, from: from ?? null, to: to ?? null, ...(await ledgerStatement('PARTY', id, from, to)) });
});

router.get('/labour/:id', validate({ params: idParam, query: rangeQuery }), async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const { from, to } = res.locals.query as z.infer<typeof rangeQuery>;
  const labour = await prisma.labour.findUnique({ where: { id }, select: { id: true, name: true, phone: true, address: true } });
  if (!labour) throw notFound('Labour');
  res.json({ account: labour, from: from ?? null, to: to ?? null, ...(await ledgerStatement('LABOUR', id, from, to)) });
});

const balancesQuery = z.object({
  type: z.enum(['PARTY', 'LABOUR']),
  q: z.string().trim().optional(),
  filter: z.enum(['all', 'payable', 'advance', 'nonzero']).default('nonzero'),
  sortBy: z.enum(['name', 'balance']).default('balance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
});

/** All accounts of one type with their current balance (payables summary). */
router.get('/balances', validate({ query: balancesQuery }), async (_req, res) => {
  const q = res.locals.query as z.infer<typeof balancesQuery>;
  const nameFilter = q.q ? { name: { contains: q.q, mode: 'insensitive' as const } } : {};
  let rows: { id: string; name: string; phone: string | null; isActive: boolean; opening: number; debit: number; credit: number; balance: number }[];
  if (q.type === 'PARTY') {
    const [accounts, balances] = await Promise.all([
      prisma.party.findMany({ where: { deletedAt: { isSet: false }, ...nameFilter } }),
      partyBalances(),
    ]);
    rows = accounts.map((a) => {
      const b = balances.get(a.id)!;
      return { id: a.id, name: a.name, phone: a.phone, isActive: a.isActive, opening: b.opening, debit: b.debit, credit: b.credit, balance: b.balance };
    });
  } else {
    const [accounts, balances] = await Promise.all([
      prisma.labour.findMany({ where: { deletedAt: { isSet: false }, ...nameFilter } }),
      labourBalances(),
    ]);
    rows = accounts.map((a) => {
      const b = balances.get(a.id) ?? { earned: 0, paid: 0, balance: 0 };
      return { id: a.id, name: a.name, phone: a.phone, isActive: a.isActive, opening: 0, debit: b.paid, credit: b.earned, balance: b.balance };
    });
  }
  rows = rows.filter((r) =>
    q.filter === 'payable' ? r.balance > 0 : q.filter === 'advance' ? r.balance < 0 : q.filter === 'nonzero' ? r.balance !== 0 : true,
  );
  const dir = q.sortOrder === 'asc' ? 1 : -1;
  rows.sort((a, b) => (q.sortBy === 'name' ? a.name.localeCompare(b.name) : a.balance - b.balance) * dir);
  const totals = {
    payable: round2(rows.filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0)),
    advance: round2(rows.filter((r) => r.balance < 0).reduce((s, r) => s - r.balance, 0)),
  };
  const start = (q.page - 1) * q.pageSize;
  res.json({ data: rows.slice(start, start + q.pageSize), meta: pageMeta(q.page, q.pageSize, rows.length), totals });
});

export default router;
