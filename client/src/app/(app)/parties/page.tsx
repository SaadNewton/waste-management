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
import { PartyFormDialog } from "@/components/parties/party-form-dialog"
import { useApiMutation } from "@/hooks/use-api-mutation"
import { useDebounce } from "@/hooks/use-debounce"
import { useFormat } from "@/hooks/use-settings"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { Paged, Party } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function PartiesPage() {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const f = useFormat()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [showDeleted, setShowDeleted] = useState(false)
  const [sort, setSort] = useState<SortState>({ sortBy: "name", sortOrder: "asc" })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [editing, setEditing] = useState<Party | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Party | null>(null)
  const q = useDebounce(search)

  const { data, isFetching } = useQuery({
    queryKey: ["parties", "list", { q, status, showDeleted, sort, page, pageSize }],
    queryFn: () =>
      api.get<Paged<Party>>("/parties", { q, status, includeDeleted: showDeleted, ...sort, page, pageSize }),
    placeholderData: keepPreviousData,
  })

  const remove = useApiMutation((id: string) => api.del<{ softDeleted: boolean }>(`/parties/${id}`), {
    success: (r) => (r.softDeleted ? "Party has transactions — archived (soft deleted)" : "Party deleted"),
    invalidate: ["parties", "ledger", "dashboard"],
    onSuccess: () => setDeleting(null),
  })
  const restore = useApiMutation((id: string) => api.post(`/parties/${id}/restore`), {
    success: "Party restored",
    invalidate: ["parties"],
  })

  const columns: Column<Party>[] = [
    {
      key: "name",
      header: "Name",
      sortKey: "name",
      cell: (p) => (
        <div className="min-w-0">
          <Link href={`/parties/${p.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
            {p.name}
          </Link>
          {p.address && <p className="truncate text-xs text-muted-foreground">{p.address}</p>}
        </div>
      ),
    },
    { key: "phone", header: "Phone", cell: (p) => p.phone ?? "—", hideOnMobile: true },
    { key: "purchases", header: "Trucks", align: "right", cell: (p) => p.purchaseCount ?? 0, hideOnMobile: true },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      cell: (p) => (
        <span className={cn("tabular-nums", p.balance > 0 ? "text-rose-600" : p.balance < 0 ? "text-emerald-600" : "")}>
          {f.balance(p.balance)}
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (p) => <StatusBadge active={p.isActive} deleted={!!p.deletedAt} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-10",
      cell: (p) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/parties/${p.id}`)}>View details</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/ledger/party/${p.id}`)}>Ledger</DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditing(p)
                  setFormOpen(true)
                }}
              >
                Edit
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  {p.deletedAt ? (
                    <DropdownMenuItem onClick={() => restore.mutate(p.id)}>Restore</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(p)}>
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
        title="Parties"
        description="Suppliers your waste trucks come from"
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus /> Add party
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
          placeholder="Search name, phone, CNIC…"
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
        rowKey={(p) => p.id}
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
        onRowClick={(p) => router.push(`/parties/${p.id}`)}
        rowClassName={(p) => (p.deletedAt ? "opacity-60" : undefined)}
        empty="No parties found"
      />
      <PartyFormDialog open={formOpen} onOpenChange={setFormOpen} party={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Parties with purchases or payments are archived (soft deleted) so their ledger stays intact. Parties with no transactions are removed permanently."
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  )
}
