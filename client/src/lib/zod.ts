import { z } from "zod"

// Form helpers. Inputs deliver strings; these coerce and validate them.

export const amount = (label = "Amount") =>
  z.coerce.number({ invalid_type_error: `${label} must be a number` }).finite().min(0, `${label} cannot be negative`)

export const positiveAmount = (label = "Amount") =>
  z.coerce.number({ invalid_type_error: `${label} must be a number` }).finite().positive(`${label} must be greater than 0`)

export const optionalAmount = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number({ invalid_type_error: "Must be a number" }).finite().min(0).nullable(),
)

export const optionalString = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v || null)
