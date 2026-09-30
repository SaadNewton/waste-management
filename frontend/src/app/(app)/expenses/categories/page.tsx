"use client"

import { useState } from "react"
import Link from "next/link"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type Column } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { StatusBadge } from "@/components/shared/status-badge"
import { CategoryFormDialog } from "@/components/expenses/category-form-dialog"
import { useApiMutation } from "@/hooks/use-api-mutation"
import { useDebounce } from "@/hooks/use-debounce"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { ExpenseCategory, Paged } from "@/lib/types"

export default function CategoriesPage() {
  const { isAdmin } = useAuth()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<ExpenseCategory | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<ExpenseCategory | null>(null)
  const q = useDebounce(search)

  const { data, isFetching } = useQuery({
    queryKey: ["expense-categories", "list", q, page],
    queryFn: () => api.get<Paged<ExpenseCategory>>("/expense-categories", { q, page, pageSize: 50, sortOrder: "asc" }),
    placeholderData: keepPreviousData,
  })
  const remove = useApiMutation((id: string) => api.del(`/expense-categories/${id}`), {
    success: "Category deleted",
    invalidate: ["expense-categories"],
    onSuccess: () => setDeleting(null),
  })

  const columns: Column<ExpenseCategory>[] = [
    { key: "name", header: "Name", cell: (c) => <span className="font-medium">{c.name}</span> },
    { key: "desc", header: "Description", cell: (c) => c.description ?? "—", hideOnMobile: true },
    { key: "count", header: "Expenses", align: "right", cell: (c) => c.expenseCount ?? 0 },
    { key: "status", header: "Status", cell: (c) => <StatusBadge active={c.isActive} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit"
            onClick={() => {
              setEditing(c)
              setFormOpen(true)
            }}
          >
            <Pencil />
          </Button>
          {isAdmin && (
            <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setDeleting(c)}>
              <Trash2 className="text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <Link href="/expenses" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Expenses
      </Link>
      <PageHeader
        title="Expense categories"
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus /> Add category
          </Button>
        }
      />
      <div className="mb-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
      </div>
      <DataTable columns={columns} rows={data?.data} loading={isFetching} rowKey={(c) => c.id} meta={data?.meta} onPageChange={setPage} />
      <CategoryFormDialog open={formOpen} onOpenChange={setFormOpen} category={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Categories that already have expenses cannot be deleted — mark them inactive instead."
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  )
}
