"use client"

import { useState } from "react"
import Link from "next/link"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ArrowDownLeft, ArrowUpRight, MoreHorizontal, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type Column, type SortState } from "@/components/shared/data-table"
import { DateRangeFilter, type DateRange } from "@/components/shared/date-range-filter"
import { ExportMenu } from "@/components/shared/export-menu"
import { PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { StatCard } from "@/components/shared/stat-card"
import { PaymentFormDialog } from "@/components/payments/payment-form-dialog"
import { useApiMutation } from "@/hooks/use-api-mutation"
import { useDebounce } from "@/hooks/use-debounce"
import { useFormat } from "@/hooks/use-settings"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDate, METHOD_LABEL, monthStartISO, todayISO } from "@/lib/format"
import type { Paged, Payment } from "@/lib/types"

type Totals = { count: number; paidOut: number; received: number }

const payeeName = (p: Payment) => p.party?.name ?? p.labour?.name ?? p.payeeName ?? "—"
const payeeHref = (p: Payment) =>
  p.partyId ? `/ledger/party/${p.partyId}` : p.labourId ? `/ledger/labour/${p.labourId}` : null
const TYPE_LABEL = { PARTY: "Party", LABOUR: "Labour", OTHER: "Other" } as const

export default function PaymentsPage() {
  const { isAdmin } = useAuth()
  const f = useFormat()
  const [range, setRange] = useState<DateRange>({ from: monthStartISO(), to: todayISO() })
  const [payeeType, setPayeeType] = useState("")
  const [direction, setDirection] = useState("")
  const [method, setMethod] = useState("")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortState>({ sortBy: "date", sortOrder: "desc" })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [editing, setEditing] = useState<Payment | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Payment | null>(null)
  const q = useDebounce(search)

  const filters = { ...range, payeeType, direction, method, q, ...sort }
  const { data, isFetching } = useQuery({
    queryKey: ["payments", "list", filters, page, pageSize],
    queryFn: () => api.get<Paged<Payment, Totals>>("/payments", { ...filters, page, pageSize }),
    placeholderData: keepPreviousData,
  })
  const remove = useApiMutation((id: string) => api.del(`/payments/${id}`), {
    success: "Payment deleted and ledger reversed",
    invalidate: "all",
    onSuccess: () => setDeleting(null),
  })
  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setPage(1)
  }

  const columns: Column<Payment>[] = [
    { key: "date", header: "Date", sortKey: "date", cell: (p) => formatDate(p.date) },
    { key: "voucher", header: "Voucher", sortKey: "serialNo", cell: (p) => <span className="font-medium">{p.voucherNo}</span> },
    {
      key: "payee",
      header: "Payee",
      cell: (p) => {
        const href = payeeHref(p)
        return (
          <div className="flex items-center gap-2">
            {href ? (
              <Link href={href} className="hover:underline">
                {payeeName(p)}
              </Link>
            ) : (
              payeeName(p)
            )}
            <Badge variant="outline">{TYPE_LABEL[p.payeeType]}</Badge>
          </div>
        )
      },
    },
    {
      key: "direction",
      header: "Type",
      cell: (p) =>
        p.direction === "OUT" ? (
          <span className="inline-flex items-center gap-1 text-rose-600">
            <ArrowUpRight className="size-3.5" /> Paid
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <ArrowDownLeft className="size-3.5" /> Received
          </span>
        ),
      hideOnMobile: true,
    },
    { key: "method", header: "Method", cell: (p) => METHOD_LABEL[p.method], hideOnMobile: true },
    { key: "note", header: "Note", cell: (p) => <span className="line-clamp-1">{p.note ?? "—"}</span>, hideOnMobile: true },
    { key: "amount", header: "Amount", sortKey: "amount", align: "right", cell: (p) => <span className="font-medium">{f.money(p.amount)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-10 no-print",
      cell: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}>
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setEditing(p)
                setFormOpen(true)
              }}
            >
              Edit
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(p)}>
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const exportData = async () => {
    const all = await api.get<Paged<Payment, Totals>>("/payments", { ...filters, page: 1, pageSize: 500 })
    return {
      filename: `payments-${range.from || "all"}-${range.to || "all"}`,
      title: "Payments & receipts",
      subtitle: range.from || range.to ? `${formatDate(range.from)} – ${formatDate(range.to)}` : "All dates",
      rows: all.data,
      columns: [
        { header: "Date", value: (p: Payment) => formatDate(p.date) },
        { header: "Voucher", value: (p: Payment) => p.voucherNo },
        { header: "Payee", value: (p: Payment) => payeeName(p), width: 24 },
        { header: "Payee type", value: (p: Payment) => TYPE_LABEL[p.payeeType] },
        { header: "Type", value: (p: Payment) => (p.direction === "OUT" ? "Paid" : "Received") },
        { header: "Method", value: (p: Payment) => METHOD_LABEL[p.method] },
        { header: "Note", value: (p: Payment) => p.note ?? "", width: 24 },
        { header: "Amount", value: (p: Payment) => p.amount, align: "right" as const },
      ],
      footer: [
        ["Total paid", "", "", "", "", "", "", all.totals.paidOut],
        ["Total received", "", "", "", "", "", "", all.totals.received],
      ],
    }
  }

  return (
    <>
      <PageHeader
        title="Payments"
        description="Payments to parties and labour, and other receipts. Each voucher posts to the ledger and cash book."
        actions={
          <>
            <ExportMenu getData={exportData} />
            <Button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus /> Record payment
            </Button>
          </>
        }
      />
      <div className="no-print mb-3 flex flex-col gap-2 xl:flex-row xl:items-center">
        <DateRangeFilter value={range} onChange={reset(setRange)} />
        <div className="flex flex-wrap gap-2 xl:ml-auto">
          <NativeSelect value={payeeType} onChange={(e) => reset(setPayeeType)(e.target.value)} aria-label="Payee type">
            <NativeSelectOption value="">All payees</NativeSelectOption>
            <NativeSelectOption value="PARTY">Parties</NativeSelectOption>
            <NativeSelectOption value="LABOUR">Labour</NativeSelectOption>
            <NativeSelectOption value="OTHER">Other</NativeSelectOption>
          </NativeSelect>
          <NativeSelect value={direction} onChange={(e) => reset(setDirection)(e.target.value)} aria-label="Direction">
            <NativeSelectOption value="">Paid &amp; received</NativeSelectOption>
            <NativeSelectOption value="OUT">Paid</NativeSelectOption>
            <NativeSelectOption value="IN">Received</NativeSelectOption>
          </NativeSelect>
          <NativeSelect value={method} onChange={(e) => reset(setMethod)(e.target.value)} aria-label="Method">
            <NativeSelectOption value="">Cash &amp; bank</NativeSelectOption>
            <NativeSelectOption value="CASH">Cash</NativeSelectOption>
            <NativeSelectOption value="BANK">Bank</NativeSelectOption>
          </NativeSelect>
          <SearchInput value={search} onChange={reset(setSearch)} placeholder="Voucher, name, note…" className="sm:w-52" />
        </div>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="Vouchers" value={data?.totals.count ?? 0} />
        <StatCard label="Total paid" value={f.money(data?.totals.paidOut)} tone="negative" />
        <StatCard label="Total received" value={f.money(data?.totals.received)} tone="positive" />
      </div>
      <DataTable
        columns={columns}
        rows={data?.data}
        loading={isFetching}
        rowKey={(p) => p.id}
        sort={sort}
        onSortChange={reset(setSort)}
        meta={data?.meta}
        onPageChange={setPage}
        onPageSizeChange={reset(setPageSize)}
        empty="No payments in this period"
      />
      <PaymentFormDialog open={formOpen} onOpenChange={setFormOpen} payment={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.voucherNo}?`}
        description="The ledger and cash-book entries for this voucher will be reversed."
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  )
}
