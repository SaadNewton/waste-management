"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { MoreHorizontal, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type Column, type SortState } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { StatusBadge } from "@/components/shared/status-badge"
import { LabourFormDialog } from "@/components/labour/labour-form-dialog"
import { useApiMutation } from "@/hooks/use-api-mutation"
import { useDebounce } from "@/hooks/use-debounce"
import { useFormat } from "@/hooks/use-settings"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { Labour, Paged } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function LabourPage() {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const f = useFormat()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [showDeleted, setShowDeleted] = useState(false)
  const [sort, setSort] = useState<SortState>({ sortBy: "name", sortOrder: "asc" })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [editing, setEditing] = useState<Labour | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Labour | null>(null)
  const q = useDebounce(search)

  const { data, isFetching } = useQuery({
    queryKey: ["labour", "list", { q, status, showDeleted, sort, page, pageSize }],
    queryFn: () => api.get<Paged<Labour>>("/labour", { q, status, includeDeleted: showDeleted, ...sort, page, pageSize }),
    placeholderData: keepPreviousData,
  })

  const remove = useApiMutation((id: string) => api.del<{ softDeleted: boolean }>(`/labour/${id}`), {
    success: (r) => (r.softDeleted ? "Labour has work history — archived (soft deleted)" : "Labour deleted"),
    invalidate: ["labour", "ledger", "dashboard"],
    onSuccess: () => setDeleting(null),
  })
  const restore = useApiMutation((id: string) => api.post(`/labour/${id}/restore`), {
    success: "Labour restored",
    invalidate: ["labour"],
  })

  const columns: Column<Labour>[] = [
    {
      key: "name",
      header: "Name",
      sortKey: "name",
      cell: (l) => (
        <Link href={`/labour/${l.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
          {l.name}
        </Link>
      ),
    },
    { key: "phone", header: "Phone", cell: (l) => l.phone ?? "—", hideOnMobile: true },
    { key: "wage", header: "Default wage", sortKey: "defaultWage", align: "right", cell: (l) => (l.defaultWage ? f.money(l.defaultWage) : "—"), hideOnMobile: true },
    { key: "jobs", header: "Trucks", align: "right", cell: (l) => l.jobs, hideOnMobile: true },
    { key: "earned", header: "Earned", align: "right", cell: (l) => f.money(l.earned), hideOnMobile: true },
    { key: "paid", header: "Paid", align: "right", cell: (l) => f.money(l.paid), hideOnMobile: true },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      cell: (l) => (
        <span className={cn("tabular-nums", l.balance > 0 ? "text-rose-600" : l.balance < 0 ? "text-emerald-600" : "")}>
          {f.balance(l.balance)}
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (l) => <StatusBadge active={l.isActive} deleted={!!l.deletedAt} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-10",
      cell: (l) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/labour/${l.id}`)}>View details</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/ledger/labour/${l.id}`)}>Ledger</DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditing(l)
                  setFormOpen(true)
                }}
              >
                Edit
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  {l.deletedAt ? (
                    <DropdownMenuItem onClick={() => restore.mutate(l.id)}>Restore</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(l)}>
                      Delete
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Labour"
        description="Workers who offload trucks"
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus /> Add labour
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search name or phone…"
        />
        <NativeSelect
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          aria-label="Status"
        >
          <NativeSelectOption value="all">All statuses</NativeSelectOption>
          <NativeSelectOption value="active">Active</NativeSelectOption>
          <NativeSelectOption value="inactive">Inactive</NativeSelectOption>
        </NativeSelect>
        {isAdmin && (
          <Button variant={showDeleted ? "secondary" : "ghost"} size="sm" onClick={() => setShowDeleted((v) => !v)}>
            {showDeleted ? "Hide deleted" : "Show deleted"}
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={data?.data}
        loading={isFetching}
        rowKey={(l) => l.id}
        sort={sort}
        onSortChange={(s) => {
          setSort(s)
          setPage(1)
        }}
        meta={data?.meta}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n)
          setPage(1)
        }}
        onRowClick={(l) => router.push(`/labour/${l.id}`)}
        rowClassName={(l) => (l.deletedAt ? "opacity-60" : undefined)}
        empty="No labour found"
      />
      <LabourFormDialog open={formOpen} onOpenChange={setFormOpen} labour={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Labourers with work history or payments are archived (soft deleted) so their ledger stays intact."
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  )
}
