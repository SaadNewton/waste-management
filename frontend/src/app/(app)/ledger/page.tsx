"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable, type Column, type SortState } from "@/components/shared/data-table"
import { ExportMenu } from "@/components/shared/export-menu"
import { PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { StatCard } from "@/components/shared/stat-card"
import { useDebounce } from "@/hooks/use-debounce"
import { useFormat } from "@/hooks/use-settings"
import { api } from "@/lib/api"
import type { BalanceRow, Paged } from "@/lib/types"
import { cn } from "@/lib/utils"

type Totals = { payable: number; advance: number }

export default function LedgerPage() {
  const router = useRouter()
  const f = useFormat()
  const [type, setType] = useState<"PARTY" | "LABOUR">("PARTY")
  const [filter, setFilter] = useState("nonzero")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortState>({ sortBy: "balance", sortOrder: "desc" })
  const [page, setPage] = useState(1)
  const q = useDebounce(search)

  const params = { type, filter, q, ...sort }
  const { data, isFetching } = useQuery({
    queryKey: ["ledger", "balances", params, page],
    queryFn: () => api.get<Paged<BalanceRow, Totals>>("/ledger/balances", { ...params, page, pageSize: 50 }),
    placeholderData: keepPreviousData,
  })
  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setPage(1)
  }
  const base = type === "PARTY" ? "party" : "labour"

  const columns: Column<BalanceRow>[] = [
    { key: "name", header: "Name", sortKey: "name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "phone", header: "Phone", cell: (r) => r.phone ?? "—", hideOnMobile: true },
    ...(type === "PARTY"
      ? [{ key: "opening", header: "Opening", align: "right" as const, cell: (r: BalanceRow) => f.balance(r.opening), hideOnMobile: true }]
      : []),
    { key: "credit", header: type === "PARTY" ? "Purchases (Cr)" : "Earned (Cr)", align: "right", cell: (r) => f.money(r.credit), hideOnMobile: true },
    { key: "debit", header: "Paid (Dr)", align: "right", cell: (r) => f.money(r.debit), hideOnMobile: true },
    {
      key: "balance",
      header: "Balance",
      sortKey: "balance",
      align: "right",
      cell: (r) => (
        <span className={cn("font-medium tabular-nums", r.balance > 0 ? "text-rose-600" : r.balance < 0 ? "text-emerald-600" : "")}>
          {f.balance(r.balance)}
        </span>
      ),
    },
  ]

  const exportData = async () => {
    const all = await api.get<Paged<BalanceRow, Totals>>("/ledger/balances", { ...params, page: 1, pageSize: 500 })
    return {
      filename: `${base}-balances`,
      title: `${type === "PARTY" ? "Party" : "Labour"} balances`,
      subtitle: `As of ${new Date().toLocaleDateString("en-PK")}`,
      orientation: "portrait" as const,
      rows: all.data,
      columns: [
        { header: "Name", value: (r: BalanceRow) => r.name, width: 28 },
        { header: "Phone", value: (r: BalanceRow) => r.phone ?? "" },
        { header: "Credit", value: (r: BalanceRow) => r.credit, align: "right" as const },
        { header: "Debit", value: (r: BalanceRow) => r.debit, align: "right" as const },
        { header: "Balance", value: (r: BalanceRow) => f.balance(r.balance), align: "right" as const, width: 20 },
      ],
      footer: [
        ["Total payable", "", "", "", f.money(all.totals.payable)],
        ["Total advance", "", "", "", f.money(all.totals.advance)],
      ],
    }
  }

  return (
    <>
      <PageHeader
        title="Ledger"
        description="Account balances. Open an account to see its full statement."
        actions={<ExportMenu getData={exportData} />}
      />
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <Tabs value={type} onValueChange={(v) => reset(setType)(v as "PARTY" | "LABOUR")}>
          <TabsList>
            <TabsTrigger value="PARTY">Parties</TabsTrigger>
            <TabsTrigger value="LABOUR">Labour</TabsTrigger>
          </TabsList>
        </Tabs>
        <NativeSelect value={filter} onChange={(e) => reset(setFilter)(e.target.value)} aria-label="Balance filter">
          <NativeSelectOption value="nonzero">Non-zero balances</NativeSelectOption>
          <NativeSelectOption value="payable">Payable only</NativeSelectOption>
          <NativeSelectOption value="advance">Advance only</NativeSelectOption>
          <NativeSelectOption value="all">All accounts</NativeSelectOption>
        </NativeSelect>
        <SearchInput value={search} onChange={reset(setSearch)} placeholder="Search name…" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard label="Total payable" value={f.money(data?.totals.payable)} tone="negative" />
        <StatCard label="Total advance / receivable" value={f.money(data?.totals.advance)} tone="positive" />
      </div>
      <DataTable
        columns={columns}
        rows={data?.data}
        loading={isFetching}
        rowKey={(r) => r.id}
        sort={sort}
        onSortChange={reset(setSort)}
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(r) => router.push(`/ledger/${base}/${r.id}`)}
        empty="No accounts match"
      />
    </>
  )
}
