# Waste Material Management System

Tracks truck purchases of waste material, offloading labour, truck rent, expenses, party and labour ledgers, payments, and daily cash flow.

- **frontend/**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), React Hook Form + Zod, TanStack Query, Recharts
- **backend/**: Node.js + Express 5 (TypeScript), Prisma 6, **MongoDB**, JWT auth, Zod validation

Currency defaults to **PKR** and can be changed in Settings. Weights are in **KG**.

---

## Setup

### Prerequisites
- Node.js 20.11+ (tested on 22)
- MongoDB 6+ with `mongod` and `mongosh` on your PATH (`brew install mongodb-community mongosh`).
  The app runs MongoDB as a single-node **replica set** on port 27018, because every financial
  save runs in a multi-document transaction and MongoDB only supports those on a replica set.

### Install and run
```bash
npm install      # installs root, backend and frontend deps; creates backend/.env and frontend/.env.local
npm run dev      # starts MongoDB, the API and the web app together
```

- Web app: http://localhost:3000
- API: http://localhost:4000/api

`npm run dev` starts MongoDB (data in `backend/.mongo-data`), syncs the Prisma schema, and runs the
API and the web app with auto-reload, all in one terminal. Press Ctrl+C to stop everything.

For sample data, run `npm run db:seed` while `npm run dev` is running. **This wipes existing data.**

Set a real `JWT_SECRET` in `backend/.env` before deploying anywhere.

### Using MongoDB Atlas instead
Every Atlas cluster, including the free tier, is already a replica set. Put its connection string in
`DATABASE_URL` in `backend/.env`, run `npm run db:push` once, then use `npm run dev:atlas`. That
skips starting a local MongoDB.

### Scripts (run from the repo root)
| Script | |
|---|---|
| `npm run dev` | MongoDB + API + web app |
| `npm run dev:atlas` | API + web app, using the database in `DATABASE_URL` |
| `npm run build` / `npm start` | Production build of both, then serve both |
| `npm run db:push` | Sync collections and indexes with `backend/prisma/schema.prisma` |
| `npm run db:seed` | Reset all data and load sample data |
| `npm run lint` | ESLint on the frontend |

Each app still has its own scripts. For example, `npm run db:reset --prefix backend` drops the
database, pushes the schema, and re-seeds.

---

## How the accounting works

Every financial document is posted to the books **in a single database transaction**:

| Document | Party / labour ledger (`LedgerEntry`) | Cash / bank book (`CashEntry`) |
|---|---|---|
| **Purchase** | Party **Cr** purchase amount · Party **Dr** truck rent (if *deducted*) · Party **Dr** amount paid now · Labour **Cr** each wage · Labour **Dr** wage (if *paid now*) | OUT: paid to party, truck rent (unless the party pays), wages paid on the spot |
| **Payment** (to party/labour) | **Dr** amount (Cr for a receipt) | OUT (IN for a receipt) |
| **Payment** (other) | none | OUT / IN (e.g. income from selling sorted material) |
| **Expense** | none | OUT |

- **Balance** = opening balance (Cr +, Dr −) + Σ credit − Σ debit. Positive means **payable** by you; negative means an **advance** or receivable.
- Ledger and cash rows store the ID of their source document. **Editing** a purchase, payment or expense deletes its old rows and re-posts new ones in the same transaction. **Deleting** it removes them. Balances are always derived from these rows, never stored, so they can't drift.
- **Daybook**: opening cash = opening cash in Settings + all movements before the start date. Closing = opening + in − out. Each day's closing is the next day's opening. Cash and bank are tracked separately.
- **Truck rent** has three modes. **I pay** makes it your cost. **I pay, deduct from party** means you pay the driver and reduce the party's payable. **Party pays** means it doesn't touch your books.
- **Grand total** on a purchase = purchase amount + labour + truck rent *only when it's your cost* (mode "I pay"). This keeps deducted rent from being counted twice.
- Parties and labour **with transactions are soft-deleted** (archived, restorable) so their ledgers stay intact. Those without transactions are deleted outright.
- Slip numbers (`PUR-00001`) and voucher numbers (`PV-00001`) come from an atomic counter (the `Counter` collection), incremented inside the save's transaction. Input is validated before a number is reserved.

### MongoDB notes
- **IDs** are MongoDB ObjectIds (24-character hex strings) in the API and in URLs.
- **Money and weights** are stored as doubles. Every value is rounded to 2 decimals when it's saved and every total is rounded when it's calculated, so floating-point noise never shows up in the books.
- **Dates** are stored at UTC midnight and exchanged as `YYYY-MM-DD`, so there's no timezone drift.
- **Soft-deleted** parties and labour have a `deletedAt` field. Active ones don't have the field at all, and restoring removes it again.

---

## API

Base URL `/api`. Every endpoint except `/auth/login` and `/health` needs `Authorization: Bearer <token>`.

List endpoints take `page`, `pageSize` (max 500), `sortBy`, `sortOrder` (`asc|desc`), `q` (search) and, where relevant, `from`/`to` (`YYYY-MM-DD`). They return `{ data, meta: { page, pageSize, total, totalPages }, totals? }`.

Errors always look like `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [{ "path", "message" }] } }`.

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | Current user |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` |
| GET/POST | `/users` | Admin only |
| PUT/DELETE | `/users/:id` | Admin only. Users with records are deactivated |
| GET / PUT | `/settings` | PUT is admin only (business info, currency, opening cash/bank) |
| GET/POST | `/parties` | Filters: `status=active\|inactive\|all`, `includeDeleted` |
| GET | `/parties/options` | Dropdown list (`includeId` keeps an inactive party) |
| GET/PUT/DELETE | `/parties/:id` | Detail includes balance and stats. DELETE soft-deletes if the party has transactions |
| POST | `/parties/:id/restore` | Admin only |
| GET | `/parties/:id/purchases` | Purchase history |
| GET/POST | `/labour` | Includes earned / paid / balance |
| GET | `/labour/options` | `includeIds=1,2` |
| GET/PUT/DELETE | `/labour/:id` | Soft-deletes if the labourer has work or payments |
| POST | `/labour/:id/restore` | Admin only |
| GET | `/labour/:id/work` | Trucks offloaded |
| GET/POST | `/purchases` | Filters: `partyId`, `vehicleNo`, date range. Returns totals |
| GET | `/purchases/next-number` | Preview of the next slip number |
| GET/PUT/DELETE | `/purchases/:id` | PUT reverses and re-posts. DELETE reverses (admin only) |
| GET/POST | `/expense-categories` | |
| GET | `/expense-categories/options` | |
| PUT/DELETE | `/expense-categories/:id` | Can't delete a category that has expenses |
| GET/POST | `/expenses` | Filters: `categoryId`, `paymentMethod`. Totals by category |
| GET/PUT/DELETE | `/expenses/:id` | |
| GET/POST | `/payments` | `payeeType=PARTY\|LABOUR\|OTHER`, `direction=OUT\|IN` |
| GET/PUT/DELETE | `/payments/:id` | |
| GET | `/ledger/party/:id` | `from`, `to` → opening, rows with running balance, closing |
| GET | `/ledger/labour/:id` | Same, for labour |
| GET | `/ledger/balances` | `type=PARTY\|LABOUR`, `filter=all\|payable\|advance\|nonzero` |
| GET | `/daybook` | `from`, `to` (≤ 1 year) → cash and bank summary, day-by-day roll-forward, transactions, purchases |
| GET | `/dashboard` | Today and month totals, top parties, payables, cash/bank, 30-day chart |
| GET | `/health` | Liveness check |

---

## Folder structure

```
backend/
  prisma/
    schema.prisma          all models, enums and relations (MongoDB)
    seed.ts                sample data, posted through the real services
  scripts/
    mongo-dev.mjs          starts a local single-node replica set (npm run mongo)
  src/
    index.ts, app.ts, routes.ts
    config/env.ts
    lib/
      posting.ts           ledger and cash-book posting / reversal (the accounting core)
      balances.ts          balances and ledger statements
      validation.ts        shared Zod helpers and list-query parsing
      dates.ts, money.ts, errors.ts, prisma.ts
    middleware/            auth (JWT, roles), validate (Zod), error handler
    modules/
      auth/  users/  settings/  parties/  labour/
      purchases/           schema, service (create/update/delete in a transaction), routes
      expenses/  payments/  ledger/  daybook/  dashboard/

frontend/src/
  app/
    login/
    (app)/                 authenticated area with the sidebar layout
      page.tsx             dashboard
      purchases/  new/  [id]/  [id]/edit/
      parties/  [id]/      labour/  [id]/
      payments/            ledger/  party/[id]/  labour/[id]/
      expenses/  categories/
      daybook/             settings/
  components/
    ui/                    shadcn/ui primitives
    shared/                data table, pagination, combobox, date range, export menu, …
    layout/                app shell, sidebar
    purchases/  parties/  labour/  payments/  expenses/  ledger/
  hooks/                   settings/formatters, dropdown options, mutations, debounce
  lib/                     API client, auth context, types, formatting, Excel/PDF export
```

## Printing and export
- The purchase view page is a printable slip (**Print slip**). App chrome is hidden when printing.
- Purchases, expenses, payments, ledger balances, ledger statements and the daybook have an **Export** menu: Excel (.xlsx), PDF and Print. Exports cover the whole filtered result, not just the current page (up to 500 rows).
