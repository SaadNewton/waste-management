"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { MoreHorizontal, Plus } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { TableCell, TableRow } from "@/components/ui/table"
import { Combobox } from "@/components/shared/combobox"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type Column, type SortState } from "@/components/shared/data-table"
import { DateRangeFilter, type DateRange } from "@/components/shared/date-range-filter"
import { ExportMenu } from "@/components/shared/export-menu"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { useApiMutation } from "@/hooks/use-api-mutation"
import { useDebounce } from "@/hooks/use-debounce"
import { usePartyOptions } from "@/hooks/use-options"
import { useFormat } from "@/hooks/use-settings"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDate, monthStartISO, todayISO } from "@/lib/format"
import type { Paged, Purchase, PurchaseTotals } from "@/lib/types"

export default function PurchasesPage() {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const f = useFormat()
  const [range, setRange] = useState<DateRange>({ from: monthStartISO(), to: todayISO() })
  const [partyId, setPartyId] = useState<string | null>(null)
  const [vehicle, setVehicle] = useState("")
  const [sort, setSort] = useState<SortState>({ sortBy: "date", sortOrder: "desc" })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [deleting, setDeleting] = useState<Purchase | null>(null)
  const vehicleNo = useDebounce(vehicle)
  const parties = usePartyOptions()

  const filters = { ...range, partyId, vehicleNo, ...sort }
  const { data, isFetching } = useQuery({
    queryKey: ["purchases", "list", filters, page, pageSize],
    queryFn: () => api.get<Paged<Purchase, PurchaseTotals>>("/purchases", { ...filters, page, pageSize }),
    placeholderData: keepPreviousData,
  })

  const remove = useApiMutation((id: string) => api.del(`/purchases/${id}`), {
    success: "Purchase deleted and ledger entries reversed",
    invalidate: "all",
    onSuccess: () => setDeleting(null),
  })

  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setPage(1)
  }

  const columns: Column<Purchase>[] = [
    { key: "date", header: "Date", sortKey: "date", cell: (p) => formatDate(p.date) },
    {
      key: "no",
      header: "Slip #",
      sortKey: "serialNo",
      cell: (p) => (
        <Link href={`/purchases/${p.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
          {p.purchaseNo}
        </Link>
      ),
    },
    { key: "party", header: "Party", cell: (p) => p.party.name },
    { key: "vehicle", header: "Vehicle", cell: (p) => p.vehicleNo, hideOnMobile: true },
    { key: "net", header: "Net weight", sortKey: "netWeight", align: "right", cell: (p) => f.weight(p.netWeight) },
    { key: "rate", header: "Rate", align: "right", cell: (p) => p.rate, hideOnMobile: true },
    { key: "amount", header: "Amount", sortKey: "amount", align: "right", cell: (p) => f.money(p.amount) },
    { key: "rent", header: "Rent", align: "right", cell: (p) => f.money(p.truckRent), hideOnMobile: true },
    { key: "labour", header: "Labour", align: "right", cell: (p) => f.money(p.labourCost), hideOnMobile: true },
    { key: "paid", header: "Paid", align: "right", cell: (p) => f.money(p.amountPaid), hideOnMobile: true },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-10 no-print",
      cell: (p) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/purchases/${p.id}`)}>View / print slip</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/purchases/${p.id}/edit`)}>Edit</DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleting(p)}>
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  const t = data?.totals
  const exportData = async () => {
    const all = await api.get<Paged<Purchase, PurchaseTotals>>("/purchases", { ...filters, page: 1, pageSize: 500 })
    const period = range.from || range.to ? `${formatDate(range.from)} – ${formatDate(range.to)}` : "All dates"
    return {
      filename: `purchases-${range.from || "all"}-${range.to || "all"}`,
      title: "Purchases",
      subtitle: period,
      rows: all.data,
      columns: [
        { header: "Date", value: (p: Purchase) => formatDate(p.date) },
        { header: "Slip #", value: (p: Purchase) => p.purchaseNo },
        { header: "Party", value: (p: Purchase) => p.party.name, width: 26 },
        { header: "Vehicle", value: (p: Purchase) => p.vehicleNo },
        { header: "Material", value: (p: Purchase) => p.material ?? "" },
        { header: `Gross (${f.unit})`, value: (p: Purchase) => p.grossWeight, align: "right" as const },
        { header: `Tare (${f.unit})`, value: (p: Purchase) => p.tareWeight, align: "right" as const },
        { header: `Net (${f.unit})`, value: (p: Purchase) => p.netWeight, align: "right" as const },
        { header: "Rate", value: (p: Purchase) => p.rate, align: "right" as const },
        { header: "Amount", value: (p: Purchase) => p.amount, align: "right" as const },
        { header: "Truck rent", value: (p: Purchase) => p.truckRent, align: "right" as const },
        { header: "Labour", value: (p: Purchase) => p.labourCost, align: "right" as const },
        { header: "Paid", value: (p: Purchase) => p.amountPaid, align: "right" as const },
        { header: "To ledger", value: (p: Purchase) => p.partyPayable, align: "right" as const },
      ],
      footer: [
        ["Total", `${all.totals.count} trucks`, "", "", "", "", "", all.totals.netWeight, "", all.totals.amount, all.totals.truckRent, all.totals.labourCost, all.totals.amountPaid, all.totals.partyPayable],
      ],
    }
  }

  return (
    <>
      <PageHeader
        title="Purchases"
        description="Truck arrivals and waste purchases"
        actions={
          <>
            <ExportMenu getData={exportData} />
            <Link href="/purchases/new" className={buttonVariants()}>
              <Plus /> New purchase
            </Link>
          </>
        }
      />
      <div className="no-print mb-3 flex flex-col gap-2 xl:flex-row xl:items-center">
        <DateRangeFilter value={range} onChange={resetPage(setRange)} />
        <div className="flex flex-wrap gap-2 xl:ml-auto">
          <Combobox
            className="w-56"
            options={(parties.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            value={partyId}
            onChange={resetPage(setPartyId)}
            allowClear
            clearLabel="All parties"
          />
          <Input className="w-40" placeholder="Vehicle no." value={vehicle} onChange={(e) => resetPage(setVehicle)(e.target.value)} />
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Trucks" value={t?.count ?? 0} />
        <StatCard label="Net weight" value={f.weight(t?.netWeight)} />
        <StatCard label="Purchase amount" value={f.money(t?.amount)} />
        <StatCard label="Labour + rent" value={f.money((t?.labourCost ?? 0) + (t?.truckRent ?? 0))} />
        <StatCard label="Unpaid to parties" value={f.money(t?.partyPayable)} className="col-span-2 md:col-span-1" />
      </div>
      <DataTable
        columns={columns}
        rows={data?.data}
        loading={isFetching}
        rowKey={(p) => p.id}
        sort={sort}
        onSortChange={resetPage(setSort)}
        meta={data?.meta}
        onPageChange={setPage}
        onPageSizeChange={resetPage(setPageSize)}
        onRowClick={(p) => router.push(`/purchases/${p.id}`)}
        empty="No purchases match these filters"
        footer={
          t && (
            <TableRow>
              <TableCell colSpan={4} className="font-semibold">
                Total ({t.count})
              </TableCell>
              <TableCell className="text-right font-semibold">{f.weight(t.netWeight)}</TableCell>
              <TableCell className="hidden lg:table-cell" />
              <TableCell className="text-right font-semibold">{f.money(t.amount)}</TableCell>
              <TableCell className="hidden text-right font-semibold lg:table-cell">{f.money(t.truckRent)}</TableCell>
              <TableCell className="hidden text-right font-semibold lg:table-cell">{f.money(t.labourCost)}</TableCell>
              <TableCell className="hidden text-right font-semibold lg:table-cell">{f.money(t.amountPaid)}</TableCell>
              <TableCell />
            </TableRow>
          )
        }
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.purchaseNo}?`}
        description="All ledger and cash-book entries created by this purchase will be reversed."
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  )
}
