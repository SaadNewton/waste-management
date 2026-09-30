"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatDate } from "@/lib/format"

type Point = { date: string; amount: number; weight: number; trucks: number }

const compact = new Intl.NumberFormat("en-PK", { notation: "compact", maximumFractionDigits: 1 })

/** Daily purchase value, single series: one hue, no legend, hover tooltip. */
export function DailyPurchasesChart({
  data,
  money,
  weight,
}: {
  data: Point[]
  money: (n: number) => string
  weight: (n: number) => string
}) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Daily purchase amount, last 30 days">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(d: string) => d.slice(8, 10)}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v: number) => compact.format(v)}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as Point
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="mb-1 font-medium">{formatDate(p.date)}</p>
                  <p>
                    <span className="text-muted-foreground">Amount </span>
                    <span className="tabular-nums">{money(p.amount)}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Weight </span>
                    <span className="tabular-nums">{weight(p.weight)}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Trucks </span>
                    <span className="tabular-nums">{p.trucks}</span>
                  </p>
                </div>
              )
            }}
          />
          <Bar dataKey="amount" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
