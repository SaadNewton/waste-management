"use client"

import { useFormat, useSettings } from "@/hooks/use-settings"
import { formatDate, METHOD_LABEL, RENT_PAID_BY_LABEL } from "@/lib/format"
import type { Purchase } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Printable purchase slip. Sized to fit A4/A5 when printed. */
export function PurchaseSlip({ purchase: p }: { purchase: Purchase }) {
  const { data: settings } = useSettings()
  const f = useFormat()
  const deducted = p.truckRentPaidBy === "DEDUCT" ? p.truckRent : 0

  return (
    <div className="mx-auto max-w-3xl rounded-xl border bg-card p-5 text-sm shadow-sm sm:p-8 print:max-w-none print:border-0 print:p-0 print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-lg font-bold">{settings?.businessName}</h2>
          {settings?.address && <p className="text-muted-foreground">{settings.address}</p>}
          {settings?.phone && <p className="text-muted-foreground">Phone: {settings.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Purchase slip</p>
          <p className="text-xl font-bold">{p.purchaseNo}</p>
          <p>{formatDate(p.date)}</p>
        </div>
      </div>

      <div className="grid gap-4 border-b py-4 sm:grid-cols-2">
        <Info label="Party" value={p.party.name} sub={[p.party.phone, p.party.address].filter(Boolean).join(" · ")} />
        <Info label="Vehicle" value={p.vehicleNo} sub={[p.driverName, p.driverPhone].filter(Boolean).join(" · ")} />
        {p.material && <Info label="Material" value={p.material} />}
      </div>

      <table className="my-4 w-full">
        <tbody className="[&_td]:py-1.5">
          <tr>
            <td className="text-muted-foreground">Gross weight</td>
            <td className="text-right tabular-nums">{f.weight(p.grossWeight)}</td>
          </tr>
          <tr>
            <td className="text-muted-foreground">Tare weight</td>
            <td className="text-right tabular-nums">− {f.weight(p.tareWeight)}</td>
          </tr>
          <tr className="border-t font-semibold">
            <td>Net weight</td>
            <td className="text-right tabular-nums">{f.weight(p.netWeight)}</td>
          </tr>
          <tr>
            <td className="text-muted-foreground">Rate per {f.unit}</td>
            <td className="text-right tabular-nums">{f.money(p.rate)}</td>
          </tr>
          <tr className="border-t font-semibold">
            <td>Purchase amount</td>
            <td className="text-right tabular-nums">{f.money(p.amount)}</td>
          </tr>
        </tbody>
      </table>

      {!!p.labours?.length && (
        <div className="mb-4">
          <p className="mb-1 font-medium">Offloading labour</p>
          <table className="w-full border-t">
            <tbody className="[&_td]:py-1">
              {p.labours.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td>{l.labour.name}</td>
                  <td className="text-muted-foreground">{l.paid ? `Paid (${METHOD_LABEL[l.paidMethod ?? "CASH"]})` : "Unpaid"}</td>
                  <td className="text-right tabular-nums">{f.money(l.wage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Line label="Purchase amount" value={f.money(p.amount)} />
          <Line
            label={`Truck rent (${RENT_PAID_BY_LABEL[p.truckRentPaidBy].toLowerCase()})`}
            value={f.money(p.truckRent)}
            muted={p.truckRentPaidBy !== "ME"}
          />
          <Line label="Labour cost" value={f.money(p.labourCost)} />
          <Line label="Grand total" value={f.money(p.grandTotal)} strong />
        </div>
        <div className="space-y-1.5 rounded-lg bg-muted/50 p-3 print:bg-transparent print:p-0">
          <Line label="Purchase amount" value={f.money(p.amount)} />
          {deducted > 0 && <Line label="Less: truck rent" value={`− ${f.money(deducted)}`} />}
          <Line label={`Paid now (${METHOD_LABEL[p.paymentMethod]})`} value={`− ${f.money(p.amountPaid)}`} />
          <Line label="Balance to party account" value={f.money(p.partyPayable)} strong />
        </div>
      </div>

      {p.notes && (
        <p className="mt-4 border-t pt-3">
          <span className="text-muted-foreground">Notes: </span>
          {p.notes}
        </p>
      )}

      <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs text-muted-foreground">
        <div className="border-t pt-1">Received by</div>
        <div className="border-t pt-1">Party / driver signature</div>
      </div>
    </div>
  )
}

function Info({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-2", strong && "border-t pt-1.5 font-semibold", muted && "text-muted-foreground")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
