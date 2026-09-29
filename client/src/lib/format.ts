import { format } from "date-fns"

// Dates travel as "YYYY-MM-DD" (or an ISO string at UTC midnight). Only the date
// part is ever used, so there is no timezone drift.

export const dateOnly = (value: string) => value.slice(0, 10)

export function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const [y, m, d] = dateOnly(value).split("-").map(Number)
  return format(new Date(y, m - 1, d), "dd MMM yyyy")
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd")
}

export function daysAgoISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return format(d, "yyyy-MM-dd")
}

export function monthStartISO() {
  return format(new Date(), "yyyy-MM-01")
}

const numberFmt = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 })
const moneyFmt = new Intl.NumberFormat("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export function formatNumber(value: number | null | undefined) {
  return numberFmt.format(value ?? 0)
}

export function formatMoney(value: number | null | undefined, currency = "PKR") {
  const n = value ?? 0
  const s = moneyFmt.format(Math.abs(n))
  return `${n < 0 ? "-" : ""}${currency} ${s}`
}

export function formatWeight(value: number | null | undefined, unit = "KG") {
  return `${numberFmt.format(value ?? 0)} ${unit}`
}

/** Payable-style balance: positive = payable (Cr), negative = advance (Dr). */
export function formatBalance(value: number, currency = "PKR") {
  if (!value) return formatMoney(0, currency)
  return `${formatMoney(Math.abs(value), currency)} ${value > 0 ? "Cr" : "Dr"}`
}

export const METHOD_LABEL = { CASH: "Cash", BANK: "Bank" } as const

export const RENT_PAID_BY_LABEL = {
  ME: "Paid by me",
  PARTY: "Paid by party",
  DEDUCT: "Deducted from party",
} as const

export const CASH_CATEGORY_LABEL: Record<string, string> = {
  PURCHASE_PAYMENT: "Purchase payment",
  TRUCK_RENT: "Truck rent",
  LABOUR_WAGE: "Labour wage",
  PARTY_PAYMENT: "Party payment",
  LABOUR_PAYMENT: "Labour payment",
  OTHER_PAYMENT: "Other payment",
  RECEIPT: "Receipt",
  EXPENSE: "Expense",
}
