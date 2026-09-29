"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, HandCoins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DateRangeFilter, type DateRange } from "@/components/shared/date-range-filter"
import { ExportMenu } from "@/components/shared/export-menu"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { PaymentFormDialog } from "@/components/payments/payment-form-dialog"
import { useFormat, useSettings } from "@/hooks/use-settings"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import type { LedgerRow, LedgerStatement as Statement } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Account statement for a party or labourer: opening balance, entries with a
 * running balance, and closing balance. Balance convention: Cr = payable.
 */
export function LedgerStatement({ type, id }: { type: "party" | "labour"; id: string }) {
  const f = useFormat()
  const { data: settings } = useSettings()
  const [range, setRange] = useState<DateRange>({ from: "", to: "" })
  const [payOpen, setPayOpen] = useState(false)

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["ledger", type, id, range],
    queryFn: () => api.get<Statement>(`/ledger/${type}/${id}`, { ...range }),
  })

  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>

  const label = type === "party" ? "Party" : "Labour"
  const period = range.from || range.to ? `${formatDate(range.from || null)} – ${formatDate(range.to || null)}` : "All transactions"
  const refLink = (r: LedgerRow) =>
    r.purchaseId ? `/purchases/${r.purchaseId}` : null

  const exportData = () => ({
    filename: `${type}-ledger-${data.account.name.replace(/\s+/g, "-").toLowerCase()}`,
    title: `${label} ledger — ${data.account.name}`,
    subtitle: `${settings?.businessName ?? ""} · ${period}`,
    orientation: "portrait" as const,
    rows: [
      { id: "opening", date: range.from || "", reference: "", description: "Opening balance", debit: 0, credit: 0, balance: data.opening, purchaseId: null, paymentId: null },
      ...data.rows,
    ],
    columns: [
      { header: "Date", value: (r: LedgerRow) => (r.date ? formatDate(r.date) : "") },
      { header: "Reference", value: (r: LedgerRow) => r.reference },
      { header: "Description", value: (r: LedgerRow) => r.description, width: 40 },
      { header: "Debit", value: (r: LedgerRow) => r.debit || "", align: "right" as const },
      { header: "Credit", value: (r: LedgerRow) => r.credit || "", align: "right" as const },
      { header: "Balance", value: (r: LedgerRow) => f.balance(r.balance), align: "right" as const, width: 20 },
    ],
    footer: [["", "", "Totals / closing balance", data.totalDebit, data.totalCredit, f.balance(data.closing)]],
  })

  return (
    <>
      <Link
        href={`/${type === "party" ? "parties" : "labour"}/${id}`}
        className="no-print mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {data.account.name}
      </Link>
      <PageHeader
        title={`${label} ledger — ${data.account.name}`}
        description={period}
        actions={
          <>
            <ExportMenu getData={exportData} />
            <Button onClick={() => setPayOpen(true)}>
              <HandCoins /> Record payment
            </Button>
          </>
        }
      />
      <div className="print-only mb-4 text-sm">
        <p className="font-semibold">{settings?.businessName}</p>
        <p>
          {label} ledger — {data.account.name} · {period}
        </p>
      </div>
      <div className="no-print mb-4">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Opening balance" value={f.balance(data.opening)} />
        <StatCard label={type === "party" ? "Debit (paid)" : "Debit (paid)"} value={f.money(data.totalDebit)} />
        <StatCard label={type === "party" ? "Credit (purchases)" : "Credit (wages earned)"} value={f.money(data.totalCredit)} />
        <StatCard
          label="Closing balance"
          value={f.balance(data.closing)}
          sub={data.closing > 0 ? "Payable" : data.closing < 0 ? "Advance" : "Settled"}
          tone={data.closing > 0 ? "negative" : data.closing < 0 ? "positive" : "default"}
        />
      </div>
      <div className={cn("rounded-xl border bg-card", isFetching && "opacity-70")}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/20">
                <TableCell>{range.from ? formatDate(range.from) : ""}</TableCell>
                <TableCell />
                <TableCell className="font-medium">Opening balance</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right font-medium tabular-nums">{f.balance(data.opening)}</TableCell>
              </TableRow>
              {data.rows.map((r) => {
                const href = refLink(r)
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {href ? (
                        <Link href={href} className="font-medium hover:underline">
                          {r.reference}
                        </Link>
                      ) : (
                        r.reference
                      )}
                    </TableCell>
                    <TableCell className="min-w-56">{r.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.debit ? f.money(r.debit) : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.credit ? f.money(r.credit) : ""}</TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">{f.balance(r.balance)}</TableCell>
                  </TableRow>
                )
              })}
              {data.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No transactions in this period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">
                  Totals / closing balance
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{f.money(data.totalDebit)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{f.money(data.totalCredit)}</TableCell>
                <TableCell className="text-right font-semibold whitespace-nowrap tabular-nums">{f.balance(data.closing)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Cr = amount payable by you · Dr = advance / amount receivable.
      </p>
      <PaymentFormDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        preset={
          type === "party"
            ? { payeeType: "PARTY", partyId: id, amount: data.closing }
            : { payeeType: "LABOUR", labourId: id, amount: data.closing }
        }
      />
    </>
  )
}
