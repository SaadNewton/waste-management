"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Banknote, Landmark } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DailyPurchasesChart } from "@/components/dashboard-chart"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { useFormat } from "@/hooks/use-settings"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import type { Dashboard, PeriodTotals, TopParty } from "@/lib/types"

export default function DashboardPage() {
  const f = useFormat()
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<Dashboard>("/dashboard"),
    refetchInterval: 60_000,
  })

  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading dashboard…</p>

  const totals = (label: string, t: PeriodTotals) => (
    <div>
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">{label}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Trucks received" value={t.trucks} />
        <StatCard label="Total weight" value={f.weight(t.weight)} />
        <StatCard label="Purchase amount" value={f.money(t.purchaseAmount)} />
        <StatCard label="Labour cost" value={f.money(t.labourCost)} />
        <StatCard label="Truck rent" value={f.money(t.truckRent)} />
        <StatCard label="Expenses" value={f.money(t.expenses)} />
      </div>
    </div>
  )

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={formatDate(data.today)}
      />
      <div className="space-y-5">
        {totals("Today", data.todayTotals)}
        {totals("This month", data.monthTotals)}

        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Balances</h2>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Link href="/ledger">
              <StatCard
                label="Payable to parties"
                value={f.money(data.payables.parties.payable)}
                sub={data.payables.parties.advance ? `Advances ${f.money(data.payables.parties.advance)}` : undefined}
                tone="negative"
                className="h-full transition-colors hover:bg-muted/40"
              />
            </Link>
            <Link href="/ledger">
              <StatCard
                label="Payable to labour"
                value={f.money(data.payables.labour.payable)}
                sub={data.payables.labour.advance ? `Advances ${f.money(data.payables.labour.advance)}` : undefined}
                tone="negative"
                className="h-full transition-colors hover:bg-muted/40"
              />
            </Link>
            <Link href="/daybook">
              <StatCard label="Cash in hand" value={f.money(data.cashInHand)} icon={Banknote} className="h-full transition-colors hover:bg-muted/40" />
            </Link>
            <Link href="/daybook">
              <StatCard label="Bank balance" value={f.money(data.bankBalance)} icon={Landmark} className="h-full transition-colors hover:bg-muted/40" />
            </Link>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader>
              <CardTitle>Daily purchases — last 30 days</CardTitle>
            </CardHeader>
            <CardContent>
              <DailyPurchasesChart data={data.chart} money={f.money} weight={f.weight} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top parties this month</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="amount">
                <TabsList className="mb-2">
                  <TabsTrigger value="amount">By amount</TabsTrigger>
                  <TabsTrigger value="weight">By weight</TabsTrigger>
                </TabsList>
                <TabsContent value="amount">
                  <TopList rows={data.topPartiesByAmount} value={(r) => f.money(r.amount)} sub={(r) => f.weight(r.weight)} />
                </TabsContent>
                <TabsContent value="weight">
                  <TopList rows={data.topPartiesByWeight} value={(r) => f.weight(r.weight)} sub={(r) => f.money(r.amount)} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent purchases</CardTitle>
            <Link href="/purchases" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="divide-y">
            {data.recent.length === 0 && <p className="text-sm text-muted-foreground">No purchases yet.</p>}
            {data.recent.map((p) => (
              <Link key={p.id} href={`/purchases/${p.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-muted/30">
                <div className="min-w-0">
                  <p className="font-medium">
                    {p.purchaseNo} · {p.party.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(p.date)} · {p.vehicleNo} · {f.weight(p.netWeight)}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums">{f.money(p.amount)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function TopList({ rows, value, sub }: { rows: TopParty[]; value: (r: TopParty) => string; sub: (r: TopParty) => string }) {
  if (!rows.length) return <p className="py-4 text-sm text-muted-foreground">No purchases this month.</p>
  return (
    <ol className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.partyId}>
          <Link href={`/parties/${r.partyId}`} className="flex items-center gap-3 text-sm hover:underline">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                {r.trucks} trucks · {sub(r)}
              </p>
            </div>
            <span className="shrink-0 font-medium tabular-nums">{value(r)}</span>
          </Link>
        </li>
      ))}
    </ol>
  )
}
