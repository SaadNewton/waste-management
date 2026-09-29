"use client"

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { PageMeta } from "@/lib/types"
import { Pagination } from "./pagination"

export interface Column<T> {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  /** Server-side sort field. When set, the header is clickable. */
  sortKey?: string
  align?: "left" | "right" | "center"
  className?: string
  /** Hide on small screens. */
  hideOnMobile?: boolean
}

export interface SortState {
  sortBy: string
  sortOrder: "asc" | "desc"
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  loading?: boolean
  rowKey: (row: T) => string | number
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  meta?: PageMeta
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  onRowClick?: (row: T) => void
  empty?: React.ReactNode
  footer?: React.ReactNode
  rowClassName?: (row: T) => string | undefined
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" }

export function DataTable<T>({
  columns,
  rows,
  loading,
  rowKey,
  sort,
  onSortChange,
  meta,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  empty = "No records found",
  footer,
  rowClassName,
}: Props<T>) {
  const toggleSort = (key: string) => {
    if (!onSortChange) return
    const order = sort?.sortBy === key && sort.sortOrder === "desc" ? "asc" : "desc"
    onSortChange({ sortBy: key, sortOrder: order })
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(alignClass[c.align ?? "left"], c.hideOnMobile && "hidden lg:table-cell", c.className)}
                >
                  {c.sortKey && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.sortKey!)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        c.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {c.header}
                      {sort?.sortBy === c.sortKey ? (
                        sort.sortOrder === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !rows?.length ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={cn(c.hideOnMobile && "hidden lg:table-cell")}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !rows?.length ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer", rowClassName?.(row), loading && "opacity-60")}
                >
                  {columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn(alignClass[c.align ?? "left"], c.hideOnMobile && "hidden lg:table-cell", c.className)}
                    >
                      {c.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
          {footer && rows?.length ? <TableFooter>{footer}</TableFooter> : null}
        </Table>
      </div>
      {meta && onPageChange && (
        <Pagination meta={meta} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
      )}
    </div>
  )
}
