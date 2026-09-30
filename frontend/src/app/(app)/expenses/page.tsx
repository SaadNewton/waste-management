"use client"

import { useState } from "react"
import Link from "next/link"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { MoreHorizontal, Plus, Tags } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { TableCell, TableRow } from "@/components/ui/table"
import { Combobox } from "@/components/shared/combobox"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type Column, type SortState } from "@/components/shared/data-table"
import { DateRangeFilter, type DateRange } from "@/components/shared/date-range-filter"
import { ExportMenu } from "@/components/shared/export-menu"
import { PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog"
import { useApiMutation } from "@/hooks/use-api-mutation"
import { useDebounce } from "@/hooks/use-debounce"
import { useCategoryOptions } from "@/hooks/use-options"
import { useFormat } from "@/hooks/use-settings"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDate, METHOD_LABEL, monthStartISO, todayISO } from "@/lib/format"
import type { Expense, Paged } from "@/lib/types"

type Totals = { count: number; amount: number; byCategory: { categoryId: string; name: string; amount: number }[] }

export default function ExpensesPage() {
  const { isAdmin } = useAuth()
  const f = useFormat()
  const [range, setRange] = useState<DateRange>({ from: monthStartISO(), to: todayISO() })
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [method, setMethod] = useState("")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortState>({ sortBy: "date", sortOrder: "desc" })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Expense | null>(null)
  const q = useDebounce(search)
  const categories = useCategoryOptions()

  const filters = { ...range, categoryId, paymentMethod: method, q, ...sort }
  const { data, isFetching } = useQuery({
    queryKey: ["expenses", "list", filters, page, pageSize],
    queryFn: () => api.get<Paged<Expense, Totals>>("/expenses", { ...filters, page, pageSize }),
    placeholderData: keepPreviousData,
  })

  const remove = useApiMutation((id: string) => api.del(`/expenses/${id}`), {
    success: "Expense deleted",
    invalidate: "all",
    onSuccess: () => setDeleting(null),
  })

  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setPage(1)
  }

  const columns: Column<Expense>[] = [
    { key: "date", header: "Date", sortKey: "date", cell: (e) => formatDate(e.date) },
    { key: "category", header: "Category", cell: (e) => <Badge variant="secondary">{e.category.name}</Badge> },
    { key: "paidTo", header: "Paid to", cell: (e) => e.paidTo ?? "—", hideOnMobile: true },
    { key: "desc", header: "Description", cell: (e) => <span className="line-clamp-1">{e.description ?? "—"}</span>, hideOnMobile: true },
    { key: "method", header: "Method", cell: (e) => METHOD_LABEL[e.paymentMethod], hideOnMobile: true },
    { key: "amount", header: "Amount", sortKey: "amount", align: "right", cell: (e) => <span className="font-medium">{f.money(e.amount)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-10 no-print",
      cell: (e) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}>
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setEditing(e)
                setFormOpen(true)
              }}
            >
              Edit
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(e)}>
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const exportData = async () => {
    const all = await api.get<Paged<Expense, Totals>>("/expenses", { ...filters, page: 1, pageSize: 500 })
    return {
      filename: `expenses-${range.from || "all"}-${range.to || "all"}`,
      title: "Expenses",
      subtitle: range.from || range.to ? `${formatDate(range.from)} – ${formatDate(range.to)}` : "All dates",
      rows: all.data,
      columns: [
        { header: "Date", value: (e: Expense) => formatDate(e.date) },
        { header: "Category", value: (e: Expense) => e.category.name },
        { header: "Paid to", value: (e: Expense) => e.paidTo ?? "", width: 20 },
        { header: "Description", value: (e: Expense) => e.description ?? "", width: 30 },
        { header: "Method", value: (e: Expense) => METHOD_LABEL[e.paymentMethod] },
        { header: "Amount", value: (e: Expense) => e.amount, align: "right" as const },
      ],
      footer: [["Total", `${all.totals.count} entries`, "", "", "", all.totals.amount]],
    }
  }

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Day-to-day running costs"
        actions={
          <>
            <Link href="/expenses/categories" className={buttonVariants({ variant: "outline" })}>
              <Tags /> Categories
            </Link>
            <ExportMenu getData={exportData} />
            <Button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus /> Add expense
            </Button>
          </>
        }
      />
      <div className="no-print mb-3 flex flex-col gap-2 xl:flex-row xl:items-center">
        <DateRangeFilter value={range} onChange={reset(setRange)} />
        <div className="flex flex-wrap gap-2 xl:ml-auto">
          <Combobox
            className="w-44"
            options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={categoryId}
            onChange={reset(setCategoryId)}
            allowClear
            clearLabel="All categories"
          />
          <NativeSelect value={method} onChange={(e) => reset(setMethod)(e.target.value)} aria-label="Method">
            <NativeSelectOption value="">Cash &amp; bank</NativeSelectOption>
            <NativeSelectOption value="CASH">Cash</NativeSelectOption>
            <NativeSelectOption value="BANK">Bank</NativeSelectOption>
          </NativeSelect>
          <SearchInput value={search} onChange={reset(setSearch)} placeholder="Search paid to / description" className="sm:w-56" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <DataTable
          columns={columns}
          rows={data?.data}
          loading={isFetching}
          rowKey={(e) => e.id}
          sort={sort}
          onSortChange={reset(setSort)}
          meta={data?.meta}
          onPageChange={setPage}
          onPageSizeChange={reset(setPageSize)}
          empty="No expenses in this period"
          footer={
            data && (
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">
                  Total ({data.totals.count})
                </TableCell>
                <TableCell colSpan={3} className="hidden lg:table-cell" />
                <TableCell className="text-right font-semibold">{f.money(data.totals.amount)}</TableCell>
                <TableCell />
              </TableRow>
            )
          }
        />
        <Card size="sm" className="self-start">
          <CardHeader>
            <CardTitle>By category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!data?.totals.byCategory.length && <p className="text-muted-foreground">No data</p>}
            {data?.totals.byCategory.map((c) => (
              <div key={c.categoryId} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{c.name}</span>
                <span className="tabular-nums">{f.money(c.amount)}</span>
              </div>
            ))}
            {!!data?.totals.byCategory.length && (
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{f.money(data.totals.amount)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <ExpenseFormDialog open={formOpen} onOpenChange={setFormOpen} expense={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this expense?"
        description={deleting ? `${deleting.category.name} — ${f.money(deleting.amount)} on ${formatDate(deleting.date)}` : undefined}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  )
}
