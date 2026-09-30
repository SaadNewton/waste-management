"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ArrowLeft, BookOpen, HandCoins, Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { DataTable, type Column } from "@/components/shared/data-table"
import { DateRangeFilter, type DateRange } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { LabourFormDialog } from "@/components/labour/labour-form-dialog"
import { PaymentFormDialog } from "@/components/payments/payment-form-dialog"
import { useFormat } from "@/hooks/use-settings"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import type { Labour, Paged } from "@/lib/types"

interface WorkRow {
  id: string
  wage: number
  paid: boolean
  purchaseId: string
  purchaseNo: string
  date: string
  vehicleNo: string
  netWeight: number
  partyName: string
}

export default function LabourDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const f = useFormat()
  const [range, setRange] = useState<DateRange>({ from: "", to: "" })
  const [page, setPage] = useState(1)
  const [editOpen, setEditOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)

  const { data: labour, isLoading, error } = useQuery({
    queryKey: ["labour", "detail", id],
    queryFn: () => api.get<Labour>(`/labour/${id}`),
  })
  const work = useQuery({
    queryKey: ["labour", "work", id, range, page],
    queryFn: () => api.get<Paged<WorkRow>>(`/labour/${id}/work`, { ...range, page, pageSize: 15 }),
    placeholderData: keepPreviousData,
  })

  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>
  if (isLoading || !labour) return <p className="text-sm text-muted-foreground">Loading…</p>

  const columns: Column<WorkRow>[] = [
    { key: "date", header: "Date", cell: (r) => formatDate(r.date) },
    { key: "no", header: "Slip #", cell: (r) => <span className="font-medium">{r.purchaseNo}</span> },
    { key: "vehicle", header: "Vehicle", cell: (r) => r.vehicleNo },
    { key: "party", header: "Party", cell: (r) => r.partyName, hideOnMobile: true },
    { key: "net", header: "Net weight", align: "right", cell: (r) => f.weight(r.netWeight), hideOnMobile: true },
    { key: "wage", header: "Wage", align: "right", cell: (r) => f.money(r.wage) },
    {
      key: "paid",
      header: "On the spot",
      cell: (r) => (r.paid ? <Badge variant="secondary">Paid</Badge> : <Badge variant="outline">To ledger</Badge>),
    },
  ]

  return (
    <>
      <Link href="/labour" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Labour
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {labour.name} <StatusBadge active={labour.isActive} deleted={!!labour.deletedAt} />
          </span>
        }
        description={[labour.phone, labour.address, labour.defaultWage && `Default wage ${f.money(labour.defaultWage)}`]
          .filter(Boolean)
          .join(" · ") || undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
            <Link href={`/ledger/labour/${labour.id}`} className={buttonVariants({ variant: "outline" })}>
              <BookOpen /> Ledger
            </Link>
            <Button onClick={() => setPayOpen(true)} disabled={!!labour.deletedAt}>
              <HandCoins /> Pay wages
            </Button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Trucks offloaded" value={labour.jobs} />
        <StatCard label="Total earned" value={f.money(labour.earned)} />
        <StatCard label="Total paid" value={f.money(labour.paid)} />
        <StatCard
          label="Balance"
          value={f.balance(labour.balance)}
          sub={labour.balance > 0 ? "Wages payable" : labour.balance < 0 ? "Advance given" : "Settled"}
          tone={labour.balance > 0 ? "negative" : labour.balance < 0 ? "positive" : "default"}
        />
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Work history</h2>
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
        rows={work.data?.data}
        loading={work.isFetching}
        rowKey={(r) => r.id}
        meta={work.data?.meta}
        onPageChange={setPage}
        onRowClick={(r) => router.push(`/purchases/${r.purchaseId}`)}
        empty="No work in this period"
      />
      <LabourFormDialog open={editOpen} onOpenChange={setEditOpen} labour={labour} />
      <PaymentFormDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        preset={{ payeeType: "LABOUR", labourId: labour.id, amount: labour.balance }}
      />
    </>
  )
}
