"use client"

import { useState } from "react"
import Link from "next/link"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { addDays, format, parseISO } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DateRangeFilter, type DateRange } from "@/components/shared/date-range-filter"
import { ExportMenu } from "@/components/shared/export-menu"
import { PageHeader } from "@/components/shared/page-header"
import { useFormat, useSettings } from "@/hooks/use-settings"
import { api } from "@/lib/api"
import { CASH_CATEGORY_LABEL, formatDate, METHOD_LABEL, todayISO } from "@/lib/format"
import type { BookSummary, CashEntry, Daybook } from "@/lib/types"
import { cn } from "@/lib/utils"

const shift = (d: string, n: number) => format(addDays(parseISO(d), n), "yyyy-MM-dd")

export default function DaybookPage() {
  const f = useFormat()
  const { data: settings } = useSettings()
  const [range, setRange] = useState<DateRange>({ from: todayISO(), to: todayISO() })
  const from = range.from || range.to || todayISO()
  const to = range.to || from
  const singleDay = from === to

  const { data, isFetching, error } = useQuery({
    queryKey: ["daybook", from, to],
    queryFn: () => api.get<Daybook>("/daybook", { from, to }),
    placeholderData: keepPreviousData,
  })

  const period = singleDay ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`
  const entryLink = (e: CashEntry) =>
    e.purchaseId ? `/purchases/${e.purchaseId}` : e.paymentId ? "/payments" : e.expenseId ? "/expenses" : null

  const exportData = () => {
    if (!data) throw new Error("Nothing to export yet")
    return {
      filename: `daybook-${from}${singleDay ? "" : `-to-${to}`}`,
      title: `Daybook — ${period}`,
      subtitle: `${settings?.businessName ?? ""} · Cash: opening ${f.money(data.cash.opening)}, in ${f.money(data.cash.in)}, out ${f.money(data.cash.out)}, closing ${f.money(data.cash.closing)}`,
      rows: data.transactions,
      columns: [
        { header: "Date", value: (e: CashEntry) => formatDate(e.date) },
        { header: "Reference", value: (e: CashEntry) => e.reference },
        { header: "Type", value: (e: CashEntry) => CASH_CATEGORY_LABEL[e.category] ?? e.category },
        { header: "Description", value: (e: CashEntry) => e.description, width: 40 },
        { header: "Method", value: (e: CashEntry) => METHOD_LABEL[e.method] },
        { header: "In", value: (e: CashEntry) => (e.direction === "IN" ? e.amount : ""), align: "right" as const },
        { header: "Out", value: (e: CashEntry) => (e.direction === "OUT" ? e.amount : ""), align: "right" as const },
      ],
      footer: [
        ["", "", "", "Cash — opening / closing", "", data.cash.opening, data.cash.closing],
        ["", "", "", "Cash — total in / out", "", data.cash.in, data.cash.out],
        ["", "", "", "Bank — total in / out", "", data.bank.in, data.bank.out],
      ],
    }
  }

  return (
    <>
      <PageHeader
        title="Daybook"
        description={period}
        actions={<ExportMenu getData={exportData} />}
      />
      <div className="print-only mb-3 text-sm">
        <p className="font-semibold">{settings?.businessName}</p>
        <p>Daybook — {period}</p>
      </div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        {singleDay && (
          <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => setRange({ from: shift(from, -1), to: shift(from, -1) })}>
            <ChevronLeft />
          </Button>
        )}
        <DateRangeFilter value={range} onChange={setRange} />
        {singleDay && (
          <Button variant="outline" size="icon" aria-label="Next day" onClick={() => setRange({ from: shift(from, 1), to: shift(from, 1) })}>
            <ChevronRight />
          </Button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{(error as Error).message}</p>}
      {!data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className={cn("space-y-4", isFetching && "opacity-70")}>
          <div className="grid gap-3 md:grid-cols-2">
            <BookCard title="Cash" book={data.cash} money={f.money} />
            <BookCard title="Bank" book={data.bank} money={f.money} />
          </div>

          {!singleDay && (
            <Card>
              <CardHeader>
                <CardTitle>Day-by-day cash</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Date</TableHead>
                      <TableHead className="text-right">Opening</TableHead>
                      <TableHead className="text-right">In</TableHead>
                      <TableHead className="text-right">Out</TableHead>
                      <TableHead className="pr-4 text-right">Closing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.days.map((d) => (
                      <TableRow key={d.date} className="cursor-pointer" onClick={() => setRange({ from: d.date, to: d.date })}>
                        <TableCell className="pl-4">{formatDate(d.date)}</TableCell>
                        <TableCell className="text-right tabular-nums">{f.money(d.opening)}</TableCell>
                        <TableCell className="text-right text-emerald-600 tabular-nums">{d.in ? f.money(d.in) : "—"}</TableCell>
                        <TableCell className="text-right text-rose-600 tabular-nums">{d.out ? f.money(d.out) : "—"}</TableCell>
                        <TableCell className="pr-4 text-right font-medium tabular-nums">{f.money(d.closing)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Cash &amp; bank transactions ({data.transactions.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {!singleDay && <TableHead className="pl-4">Date</TableHead>}
                    <TableHead className={cn(singleDay && "pl-4")}>Ref</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="pr-4 text-right">Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No cash or bank movements
                      </TableCell>
                    </TableRow>
                  )}
                  {data.transactions.map((e) => {
                    const href = entryLink(e)
                    return (
                      <TableRow key={e.id}>
                        {!singleDay && <TableCell className="pl-4 whitespace-nowrap">{formatDate(e.date)}</TableCell>}
                        <TableCell className={cn("whitespace-nowrap", singleDay && "pl-4")}>
                          {href ? (
                            <Link href={href} className="font-medium hover:underline">
                              {e.reference}
                            </Link>
                          ) : (
                            e.reference
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{CASH_CATEGORY_LABEL[e.category] ?? e.category}</Badge>
                        </TableCell>
                        <TableCell className="min-w-56">{e.description}</TableCell>
                        <TableCell>{METHOD_LABEL[e.method]}</TableCell>
                        <TableCell className="text-right text-emerald-600 tabular-nums">{e.direction === "IN" ? f.money(e.amount) : ""}</TableCell>
                        <TableCell className="pr-4 text-right text-rose-600 tabular-nums">{e.direction === "OUT" ? f.money(e.amount) : ""}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                {data.transactions.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={singleDay ? 4 : 5} className="pl-4 font-semibold">
                        Total (cash + bank)
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{f.money(data.cash.in + data.bank.in)}</TableCell>
                      <TableCell className="pr-4 text-right font-semibold tabular-nums">{f.money(data.cash.out + data.bank.out)}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card>
              <CardHeader>
                <CardTitle>Purchases ({data.purchaseTotals.count})</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Slip #</TableHead>
                      <TableHead>Party</TableHead>
                      <TableHead className="hidden lg:table-cell">Vehicle</TableHead>
                      <TableHead className="text-right">Net weight</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="pr-4 text-right">Paid now</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.purchases.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No purchases
                        </TableCell>
                      </TableRow>
                    )}
                    {data.purchases.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="pl-4">
                          <Link href={`/purchases/${p.id}`} className="font-medium hover:underline">
                            {p.purchaseNo}
                          </Link>
                        </TableCell>
                        <TableCell>{p.party.name}</TableCell>
                        <TableCell className="hidden lg:table-cell">{p.vehicleNo}</TableCell>
                        <TableCell className="text-right tabular-nums">{f.weight(p.netWeight)}</TableCell>
                        <TableCell className="text-right tabular-nums">{f.money(p.amount)}</TableCell>
                        <TableCell className="pr-4 text-right tabular-nums">{f.money(p.amountPaid)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {data.purchases.length > 0 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2} className="pl-4 font-semibold">
                          Total
                        </TableCell>
                        <TableCell className="hidden lg:table-cell" />
                        <TableCell className="text-right font-semibold tabular-nums">{f.weight(data.purchaseTotals.netWeight)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{f.money(data.purchaseTotals.amount)}</TableCell>
                        <TableCell className="pr-4 text-right font-semibold tabular-nums">{f.money(data.purchaseTotals.amountPaid)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </CardContent>
            </Card>
            <Card className="self-start">
              <CardHeader>
                <CardTitle>Summary by type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.byCategory.length === 0 && <p className="text-muted-foreground">No movements</p>}
                {data.byCategory.map((c) => (
                  <div key={c.category} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{CASH_CATEGORY_LABEL[c.category] ?? c.category}</span>
                    <span className={cn("tabular-nums", c.in ? "text-emerald-600" : "text-rose-600")}>
                      {c.in ? `+${f.money(c.in)}` : ""}
                      {c.in && c.out ? " / " : ""}
                      {c.out ? `−${f.money(c.out)}` : ""}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-2 text-xs text-muted-foreground">
                  Labour cost on purchases: {f.money(data.purchaseTotals.labourCost)} · Truck rent: {f.money(data.purchaseTotals.truckRent)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}

function BookCard({ title, book, money }: { title: string; book: BookSummary; money: (n: number) => string }) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="mb-2 text-sm font-semibold">{title}</p>
        <div className="grid grid-cols-4 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Opening</p>
            <p className="font-medium tabular-nums">{money(book.opening)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">In</p>
            <p className="font-medium text-emerald-600 tabular-nums">{money(book.in)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Out</p>
            <p className="font-medium text-rose-600 tabular-nums">{money(book.out)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Closing</p>
            <p className={cn("font-semibold tabular-nums", book.closing < 0 && "text-destructive")}>{money(book.closing)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
