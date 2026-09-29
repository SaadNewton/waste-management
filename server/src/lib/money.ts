// Money and weights are stored as doubles in MongoDB. Every value is rounded to
// 2 decimals on the way in and every sum is rounded on the way out, so float
// noise (0.1 + 0.2) never reaches the books or the UI.

/** Round to 2 decimal places. */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Normalise a possibly-null aggregate to a 2-dp number. */
export const num = (v: number | null | undefined) => (v == null ? 0 : round2(v));
