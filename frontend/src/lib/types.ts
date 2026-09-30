export type Role = "ADMIN" | "STAFF"
export type Method = "CASH" | "BANK"
export type BalanceType = "DR" | "CR"
export type TruckRentPaidBy = "ME" | "PARTY" | "DEDUCT"
export type PayeeType = "PARTY" | "LABOUR" | "OTHER"
export type Direction = "IN" | "OUT"

export interface User {
  id: string
  name: string
  email: string
  role: Role
  isActive?: boolean
}

export interface PageMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface Paged<T, Totals = undefined> {
  data: T[]
  meta: PageMeta
  totals: Totals
}

export interface Settings {
  businessName: string
  address: string | null
  phone: string | null
  currency: string
  weightUnit: string
  openingCash: number
  openingBank: number
}

export interface Party {
  id: string
  name: string
  phone: string | null
  address: string | null
  cnic: string | null
  openingBalance: number
  openingType: BalanceType
  notes: string | null
  isActive: boolean
  deletedAt: string | null
  createdAt: string
  balance: number
  purchaseCount?: number
}

export interface PartyDetail extends Party {
  stats: {
    purchases: number
    totalWeight: number
    totalAmount: number
    totalPaid: number
    paidAtPurchase: number
    paidByVoucher: number
  }
}

export interface Labour {
  id: string
  name: string
  phone: string | null
  address: string | null
  defaultWage: number | null
  isActive: boolean
  deletedAt: string | null
  createdAt: string
  jobs: number
  earned: number
  paid: number
  balance: number
}

export interface Option {
  id: string
  name: string
  phone?: string | null
  defaultWage?: number | null
  isActive?: boolean
}

export interface PurchaseLabourRow {
  id: string
  labourId: string
  wage: number
  paid: boolean
  paidMethod: Method | null
  labour: { id: string; name: string }
}

export interface Purchase {
  id: string
  purchaseNo: string
  date: string
  partyId: string
  vehicleNo: string
  driverName: string | null
  driverPhone: string | null
  material: string | null
  grossWeight: number
  tareWeight: number
  netWeight: number
  rate: number
  amount: number
  truckRent: number
  truckRentPaidBy: TruckRentPaidBy
  truckRentMethod: Method
  labourCost: number
  amountPaid: number
  paymentMethod: Method
  grandTotal: number
  partyPayable: number
  notes: string | null
  createdAt: string
  party: { id: string; name: string; phone?: string | null; address?: string | null }
  labours?: PurchaseLabourRow[]
  createdBy?: { id: string; name: string } | null
  _count?: { labours: number }
}

export interface PurchaseTotals {
  count: number
  netWeight: number
  amount: number
  truckRent: number
  labourCost: number
  amountPaid: number
  grandTotal: number
  partyPayable: number
}

export interface ExpenseCategory {
  id: string
  name: string
  description: string | null
  isActive: boolean
  expenseCount?: number
}

export interface Expense {
  id: string
  date: string
  categoryId: string
  amount: number
  paymentMethod: Method
  paidTo: string | null
  description: string | null
  category: { id: string; name: string }
}

export interface Payment {
  id: string
  voucherNo: string
  date: string
  payeeType: PayeeType
  direction: Direction
  partyId: string | null
  labourId: string | null
  payeeName: string | null
  amount: number
  method: Method
  note: string | null
  party: { id: string; name: string } | null
  labour: { id: string; name: string } | null
}

export interface LedgerRow {
  id: string
  date: string
  reference: string
  description: string
  debit: number
  credit: number
  balance: number
  purchaseId: string | null
  paymentId: string | null
}

export interface LedgerStatement {
  account: { id: string; name: string; phone: string | null; address: string | null }
  from: string | null
  to: string | null
  opening: number
  rows: LedgerRow[]
  totalDebit: number
  totalCredit: number
  closing: number
}

export interface BalanceRow {
  id: string
  name: string
  phone: string | null
  isActive: boolean
  opening: number
  debit: number
  credit: number
  balance: number
}

export interface BookSummary {
  opening: number
  in: number
  out: number
  closing: number
}

export interface CashEntry {
  id: string
  date: string
  method: Method
  direction: Direction
  category: string
  amount: number
  reference: string
  description: string
  purchaseId: string | null
  paymentId: string | null
  expenseId: string | null
}

export interface Daybook {
  from: string
  to: string
  cash: BookSummary
  bank: BookSummary
  days: ({ date: string } & BookSummary)[]
  transactions: CashEntry[]
  byCategory: { category: string; in: number; out: number }[]
  purchases: (Pick<
    Purchase,
    | "id" | "purchaseNo" | "date" | "vehicleNo" | "material" | "netWeight" | "rate" | "amount"
    | "truckRent" | "truckRentPaidBy" | "labourCost" | "amountPaid" | "partyPayable"
  > & { party: { id: string; name: string } })[]
  purchaseTotals: Omit<PurchaseTotals, "grandTotal">
}

export interface PeriodTotals {
  trucks: number
  weight: number
  purchaseAmount: number
  labourCost: number
  truckRent: number
  expenses: number
}

export interface TopParty {
  partyId: string
  name: string
  trucks: number
  weight: number
  amount: number
}

export interface Dashboard {
  today: string
  todayTotals: PeriodTotals
  monthTotals: PeriodTotals
  topPartiesByAmount: TopParty[]
  topPartiesByWeight: TopParty[]
  payables: {
    parties: { payable: number; advance: number }
    labour: { payable: number; advance: number }
  }
  cashInHand: number
  bankBalance: number
  chart: { date: string; amount: number; weight: number; trucks: number }[]
  recent: { id: string; purchaseNo: string; date: string; vehicleNo: string; netWeight: number; amount: number; party: { name: string } }[]
}
