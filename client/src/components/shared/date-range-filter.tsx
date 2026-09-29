"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { daysAgoISO, monthStartISO, todayISO } from "@/lib/format"

export interface DateRange {
  from: string
  to: string
}

export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  const presets = [
    { label: "Today", range: { from: todayISO(), to: todayISO() } },
    { label: "7 days", range: { from: daysAgoISO(6), to: todayISO() } },
    { label: "This month", range: { from: monthStartISO(), to: todayISO() } },
    { label: "All", range: { from: "", to: "" } },
  ]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label="From date"
          value={value.from}
          max={value.to || undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="w-38"
        />
        <span className="text-sm text-muted-foreground">to</span>
        <Input
          type="date"
          aria-label="To date"
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="w-38"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => {
          const active = p.range.from === value.from && p.range.to === value.to
          return (
            <Button key={p.label} size="sm" variant={active ? "secondary" : "ghost"} onClick={() => onChange(p.range)}>
              {p.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
