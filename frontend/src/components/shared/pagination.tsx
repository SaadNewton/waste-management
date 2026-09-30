"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { PageMeta } from "@/lib/types"

export function Pagination({
  meta,
  onPageChange,
  onPageSizeChange,
}: {
  meta: PageMeta
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
}) {
  const start = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1
  const end = Math.min(meta.page * meta.pageSize, meta.total)
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
      <span>
        {start}–{end} of {meta.total}
      </span>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <NativeSelect
            size="sm"
            value={meta.pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {[10, 20, 50, 100].map((n) => (
              <NativeSelectOption key={n} value={n}>
                {n} / page
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <Button
          variant="outline"
          size="icon-sm"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <span className="tabular-nums">
          {meta.page} / {meta.totalPages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
