// All business dates are stored as Postgres DATE (UTC midnight). The API accepts and
// returns plain "YYYY-MM-DD" strings so no timezone shifting ever happens.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(value: string) {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

export function toDbDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function fromDbDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Today's date in the server's local timezone as YYYY-MM-DD. */
export function todayString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(value: string, days: number): string {
  const d = toDbDate(value);
  d.setUTCDate(d.getUTCDate() + days);
  return fromDbDate(d);
}

export function monthStart(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

/** Prisma `where` fragment for an inclusive date range. */
export function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: toDbDate(from) } : {}),
    ...(to ? { lte: toDbDate(to) } : {}),
  };
}
