"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ArrowLeft, BookOpen, HandCoins, Pencil } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/shared/data-table"
import { DateRangeFilter, type DateRange } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { PartyFormDialog } from "@/components/parties/party-form-dialog"
import { PaymentFormDialog } from "@/components/payments/payment-form-dialog"
import { useFormat } from "@/hooks/use-settings"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import type { Paged, PartyDetail, Purchase } from "@/lib/types"

export default function PartyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const f = useFormat()
  const [range, setRange] = useState<DateRange>({ from: "", to: "" })
  const [page, setPage] = useState(1)
  const [editOpen, setEditOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)

  const { data: party, isLoading, error } = useQuery({
    queryKey: ["parties", "detail", id],
    queryFn: () => api.get<PartyDetail>(`/parties/${id}`),
  })
  const history = useQuery({
    queryKey: ["parties", "purchases", id, range, page],
    queryFn: () => api.get<Paged<Purchase>>(`/parties/${id}/purchases`, { ...range, page, pageSize: 15 }),
    placeholderData: keepPreviousData,
  })

  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>
  if (isLoading || !party) return <p className="text-sm text-muted-foreground">Loading…</p>

  const columns: Column<Purchase>[] = [
    { key: "date", header: "Date", cell: (p) => formatDate(p.date) },
    { key: "no", header: "Slip #", cell: (p) => <span className="font-medium">{p.purchaseNo}</span> },
    { key: "vehicle", header: "Vehicle", cell: (p) => p.vehicleNo, hideOnMobile: true },
    { key: "material", header: "Material", cell: (p) => p.material ?? "—", hideOnMobile: true },
    { key: "net", header: "Net weight", align: "right", cell: (p) => f.weight(p.netWeight) },
    { key: "rate", header: "Rate", align: "right", cell: (p) => p.rate, hideOnMobile: true },
    { key: "amount", header: "Amount", align: "right", cell: (p) => f.money(p.amount) },
    { key: "paid", header: "Paid now", align: "right", cell: (p) => f.money(p.amountPaid), hideOnMobile: true },
  ]

  return (
    <>
      <Link href="/parties" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Parties
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {party.name} <StatusBadge active={party.isActive} deleted={!!party.deletedAt} />
          </span>
        }
        description={[party.phone, party.address, party.cnic && `CNIC ${party.cnic}`].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
            <Link href={`/ledger/party/${party.id}`} className={buttonVariants({ variant: "outline" })}>
              <BookOpen /> Ledger
            </Link>
            <Button onClick={() => setPayOpen(true)} disabled={!!party.deletedAt}>
              <HandCoins /> Pay party
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Current balance"
          value={f.balance(party.balance)}
          sub={party.balance > 0 ? "Payable to party" : party.balance < 0 ? "Advance / receivable" : "Settled"}
          tone={party.balance > 0 ? "negative" : party.balance < 0 ? "positive" : "default"}
          className="col-span-2 md:col-span-1"
        />
        <StatCard label="Trucks" value={party.stats.purchases} />
        <StatCard label="Total weight" value={f.weight(party.stats.totalWeight)} />
        <StatCard label="Purchase value" value={f.money(party.stats.totalAmount)} />
        <StatCard label="Total paid" value={f.money(party.stats.totalPaid)} sub="Incl. deductions" />
      </div>

      {(party.openingBalance > 0 || party.notes) && (
        <Card size="sm" className="mb-5">
          <CardContent className="space-y-1 text-sm">
            {party.openingBalance > 0 && (
              <p>
                <span className="text-muted-foreground">Opening balance:</span> {f.money(party.openingBalance)} {party.openingType}
              </p>
            )}
            {party.notes && (
              <p>
                <span className="text-muted-foreground">Notes:</span> {party.notes}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Purchase history</h2>
        <DateRangeFilter
          value={range}
          onChange={(r) => {
            setRange(r)
            setPage(1)
          }}
        />
      </div>
      <DataTable
        columns={columns}
        rows={history.data?.data}
        loading={history.isFetching}
        rowKey={(p) => p.id}
        meta={history.data?.meta}
        onPageChange={setPage}
        onRowClick={(p) => router.push(`/purchases/${p.id}`)}
        empty="No purchases in this period"
      />

      <PartyFormDialog open={editOpen} onOpenChange={setEditOpen} party={party} />
      <PaymentFormDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        preset={{ payeeType: "PARTY", partyId: party.id, amount: party.balance }}
      />
    </>
  )
}
