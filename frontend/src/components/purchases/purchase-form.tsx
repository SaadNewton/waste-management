"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { z } from "zod"
import { Plus, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Combobox } from "@/components/shared/combobox"
import { Field } from "@/components/shared/field"
import { useApiMutation } from "@/hooks/use-api-mutation"
import { useLabourOptions, usePartyOptions } from "@/hooks/use-options"
import { useFormat } from "@/hooks/use-settings"
import { api } from "@/lib/api"
import { todayISO } from "@/lib/format"
import type { Purchase } from "@/lib/types"
import { cn } from "@/lib/utils"
import { amount, optionalString, positiveAmount } from "@/lib/zod"

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const toNum = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""))
  return Number.isFinite(n) ? n : 0
}

const labourRow = z.object({
  labourId: z.string().nullable().refine((v) => v != null, "Select a labourer"),
  wage: positiveAmount("Wage"),
  paid: z.boolean(),
  paidMethod: z.enum(["CASH", "BANK"]),
})

const schema = z
  .object({
    date: z.string().min(1, "Date is required"),
    partyId: z.string().nullable().refine((v) => v != null, "Party is required"),
    vehicleNo: z.string().trim().min(1, "Vehicle number is required").max(30),
    driverName: optionalString,
    driverPhone: optionalString,
    material: optionalString,
    grossWeight: positiveAmount("Gross weight"),
    tareWeight: amount("Tare weight"),
    rate: amount("Rate"),
    amount: amount("Amount"),
    truckRent: amount("Truck rent"),
    truckRentPaidBy: z.enum(["ME", "PARTY", "DEDUCT"]),
    truckRentMethod: z.enum(["CASH", "BANK"]),
    amountPaid: amount("Amount paid"),
    paymentMethod: z.enum(["CASH", "BANK"]),
    labours: z.array(labourRow),
    notes: optionalString,
  })
  .superRefine((v, ctx) => {
    if (v.tareWeight >= v.grossWeight) {
      ctx.addIssue({ code: "custom", path: ["tareWeight"], message: "Tare must be less than gross weight" })
    }
    const deducted = v.truckRentPaidBy === "DEDUCT" ? v.truckRent : 0
    if (deducted > v.amount) {
      ctx.addIssue({ code: "custom", path: ["truckRent"], message: "Rent to deduct exceeds the purchase amount" })
    }
    if (v.amountPaid > round2(v.amount - deducted)) {
      ctx.addIssue({ code: "custom", path: ["amountPaid"], message: "Cannot pay more than the amount due to the party" })
    }
  })

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

function toFormValues(p?: Purchase): FormInput {
  if (!p) {
    return {
      date: todayISO(),
      partyId: null,
      vehicleNo: "",
      driverName: "",
      driverPhone: "",
      material: "",
      grossWeight: "" as unknown as number,
      tareWeight: "" as unknown as number,
      rate: "" as unknown as number,
      amount: 0,
      truckRent: 0,
      truckRentPaidBy: "ME",
      truckRentMethod: "CASH",
      amountPaid: 0,
      paymentMethod: "CASH",
      labours: [],
      notes: "",
    }
  }
  return {
    date: p.date.slice(0, 10),
    partyId: p.partyId,
    vehicleNo: p.vehicleNo,
    driverName: p.driverName ?? "",
    driverPhone: p.driverPhone ?? "",
    material: p.material ?? "",
    grossWeight: p.grossWeight,
    tareWeight: p.tareWeight,
    rate: p.rate,
    amount: p.amount,
    truckRent: p.truckRent,
    truckRentPaidBy: p.truckRentPaidBy,
    truckRentMethod: p.truckRentMethod,
    amountPaid: p.amountPaid,
    paymentMethod: p.paymentMethod,
    labours: (p.labours ?? []).map((l) => ({ labourId: l.labourId, wage: l.wage, paid: l.paid, paidMethod: l.paidMethod ?? "CASH" })),
    notes: p.notes ?? "",
  }
}

export function PurchaseForm({ purchase }: { purchase?: Purchase }) {
  const router = useRouter()
  const f = useFormat()
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(purchase),
  })
  const { errors } = form.formState
  const labourRows = useFieldArray({ control: form.control, name: "labours" })

  // Amount follows net × rate until the user types their own amount.
  const [amountManual, setAmountManual] = useState(
    () => !!purchase && round2(purchase.netWeight * purchase.rate) !== purchase.amount,
  )

  const parties = usePartyOptions(purchase?.partyId)
  const labour = useLabourOptions(purchase?.labours?.map((l) => l.labourId))
  const nextNo = useQuery({
    queryKey: ["purchases", "next-number"],
    queryFn: () => api.get<{ purchaseNo: string }>("/purchases/next-number"),
    enabled: !purchase,
  })

  const w = useWatch({ control: form.control })
  const gross = toNum(w.grossWeight)
  const tare = toNum(w.tareWeight)
  const net = round2(Math.max(gross - tare, 0))
  const rate = toNum(w.rate)
  const amountValue = toNum(w.amount)
  const rent = toNum(w.truckRent)
  const paid = toNum(w.amountPaid)
  const rentPaidBy = w.truckRentPaidBy ?? "ME"
  const labourCost = round2((w.labours ?? []).reduce((s, l) => s + toNum(l?.wage), 0))
  const deducted = rentPaidBy === "DEDUCT" ? rent : 0
  const dueToParty = round2(amountValue - deducted)
  const remaining = round2(dueToParty - paid)
  const grandTotal = round2(amountValue + (rentPaidBy === "ME" ? rent : 0) + labourCost)

  useEffect(() => {
    if (!amountManual) form.setValue("amount", round2(net * rate), { shouldValidate: form.formState.isSubmitted })
  }, [net, rate, amountManual, form])

  const labourOptions = useMemo(
    () => (labour.data ?? []).map((l) => ({ value: l.id, label: l.name, hint: l.defaultWage ? `Default ${f.money(l.defaultWage)}` : null })),
    [labour.data, f],
  )

  const save = useApiMutation(
    (v: FormOutput) => {
      const body = { ...v, vehicleNo: v.vehicleNo.toUpperCase() }
      return purchase ? api.put<Purchase>(`/purchases/${purchase.id}`, body) : api.post<Purchase>("/purchases", body)
    },
    {
      success: (p) => (purchase ? `${p.purchaseNo} updated` : `${p.purchaseNo} saved`),
      invalidate: "all",
      onSuccess: (p) => router.push(`/purchases/${p.id}`),
    },
  )

  const addLabourRow = () => labourRows.append({ labourId: null, wage: "" as unknown as number, paid: false, paidMethod: "CASH" })

  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-4">
        {/* Slip & party */}
        <Card>
          <CardHeader>
            <CardTitle>Slip</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Date" htmlFor="date" required error={errors.date?.message}>
              <Input id="date" type="date" {...form.register("date")} />
            </Field>
            <Field label="Slip number">
              <Input value={purchase?.purchaseNo ?? nextNo.data?.purchaseNo ?? "Auto"} readOnly disabled />
            </Field>
            <Field label="Party" required error={errors.partyId?.message}>
              <Controller
                control={form.control}
                name="partyId"
                render={({ field }) => (
                  <Combobox
                    options={(parties.data ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.phone }))}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select party"
                    searchPlaceholder="Search parties…"
                    invalid={!!errors.partyId}
                  />
                )}
              />
            </Field>
          </CardContent>
        </Card>

        {/* Vehicle */}
        <Card>
          <CardHeader>
            <CardTitle>Vehicle</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Vehicle / truck no." htmlFor="vehicleNo" required error={errors.vehicleNo?.message}>
              <Input id="vehicleNo" className="uppercase" placeholder="LES-1234" {...form.register("vehicleNo")} />
            </Field>
            <Field label="Driver name" htmlFor="driverName">
              <Input id="driverName" {...form.register("driverName")} />
            </Field>
            <Field label="Driver phone" htmlFor="driverPhone">
              <Input id="driverPhone" inputMode="tel" {...form.register("driverPhone")} />
            </Field>
            <Field label="Material" htmlFor="material">
              <Input id="material" placeholder="e.g. Cardboard" {...form.register("material")} />
            </Field>
          </CardContent>
        </Card>

        {/* Weight & amount */}
        <Card>
          <CardHeader>
            <CardTitle>Weight &amp; amount</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label={`Gross weight (${f.unit})`} htmlFor="grossWeight" required error={errors.grossWeight?.message}>
              <Input id="grossWeight" type="number" step="0.01" min="0" inputMode="decimal" {...form.register("grossWeight")} />
            </Field>
            <Field label={`Tare weight (${f.unit})`} htmlFor="tareWeight" required error={errors.tareWeight?.message}>
              <Input id="tareWeight" type="number" step="0.01" min="0" inputMode="decimal" {...form.register("tareWeight")} />
            </Field>
            <Field label={`Net weight (${f.unit})`} hint="Gross − tare">
              <Input value={net ? net.toLocaleString("en-PK") : ""} readOnly className="bg-muted font-semibold" />
            </Field>
            <Field label={`Rate per ${f.unit}`} htmlFor="rate" required error={errors.rate?.message}>
              <Input id="rate" type="number" step="0.01" min="0" inputMode="decimal" {...form.register("rate")} />
            </Field>
            <Field
              label="Purchase amount"
              htmlFor="amount"
              error={errors.amount?.message}
              hint={amountManual ? "Edited manually" : "Net × rate"}
              className="sm:col-span-2"
            >
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className="font-semibold"
                  {...form.register("amount", { onChange: () => setAmountManual(true) })}
                />
                {amountManual && (
                  <Button type="button" variant="outline" onClick={() => setAmountManual(false)} title="Recalculate from net × rate">
                    <RotateCcw /> Auto
                  </Button>
                )}
              </div>
            </Field>
          </CardContent>
        </Card>

        {/* Truck rent */}
        <Card>
          <CardHeader>
            <CardTitle>Truck rent</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Rent amount" htmlFor="truckRent" error={errors.truckRent?.message}>
              <Input id="truckRent" type="number" step="0.01" min="0" inputMode="decimal" {...form.register("truckRent")} />
            </Field>
            <Field label="Who pays" htmlFor="truckRentPaidBy">
              <NativeSelect id="truckRentPaidBy" className="w-full" {...form.register("truckRentPaidBy")}>
                <NativeSelectOption value="ME">I pay (my cost)</NativeSelectOption>
                <NativeSelectOption value="DEDUCT">I pay, deduct from party</NativeSelectOption>
                <NativeSelectOption value="PARTY">Party pays driver</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field label="Paid via" htmlFor="truckRentMethod">
              <NativeSelect id="truckRentMethod" className="w-full" disabled={rentPaidBy === "PARTY"} {...form.register("truckRentMethod")}>
                <NativeSelectOption value="CASH">Cash</NativeSelectOption>
                <NativeSelectOption value="BANK">Bank</NativeSelectOption>
              </NativeSelect>
            </Field>
          </CardContent>
        </Card>

        {/* Labour */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Offloading labour</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLabourRow}>
              <Plus /> Add labourer
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {labourRows.fields.length === 0 && (
              <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                No labour added.{" "}
                <button type="button" onClick={addLabourRow} className="font-medium text-primary hover:underline">
                  Add a labourer
                </button>
              </p>
            )}
            {labourRows.fields.map((row, i) => {
              const rowErrors = errors.labours?.[i]
              const isPaid = w.labours?.[i]?.paid
              return (
                <div key={row.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_11rem_auto] sm:items-start sm:border-0 sm:p-0">
                  <div className="col-span-2 sm:col-span-1">
                    <Controller
                      control={form.control}
                      name={`labours.${i}.labourId`}
                      render={({ field }) => (
                        <Combobox
                          options={labourOptions}
                          value={field.value}
                          onChange={(id) => {
                            field.onChange(id)
                            const opt = labour.data?.find((l) => l.id === id)
                            if (opt?.defaultWage && !toNum(form.getValues(`labours.${i}.wage`))) {
                              form.setValue(`labours.${i}.wage`, opt.defaultWage)
                            }
                          }}
                          placeholder="Select labourer"
                          invalid={!!rowErrors?.labourId}
                        />
                      )}
                    />
                    {rowErrors?.labourId && <p className="mt-1 text-xs text-destructive">{rowErrors.labourId.message}</p>}
                  </div>
                  <div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder="Wage"
                      aria-label="Wage"
                      aria-invalid={!!rowErrors?.wage}
                      {...form.register(`labours.${i}.wage`)}
                    />
                    {rowErrors?.wage && <p className="mt-1 text-xs text-destructive">{rowErrors.wage.message}</p>}
                  </div>
                  <div className="flex h-8 items-center gap-2">
                    <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                      <Controller
                        control={form.control}
                        name={`labours.${i}.paid`}
                        render={({ field }) => (
                          <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                        )}
                      />
                      Paid now
                    </label>
                    {isPaid && (
                      <NativeSelect size="sm" aria-label="Paid via" {...form.register(`labours.${i}.paidMethod`)}>
                        <NativeSelectOption value="CASH">Cash</NativeSelectOption>
                        <NativeSelectOption value="BANK">Bank</NativeSelectOption>
                      </NativeSelect>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => labourRows.remove(i)}
                    aria-label="Remove labourer"
                    className="row-start-2 justify-self-end sm:row-start-auto"
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              )
            })}
            {labourRows.fields.length > 0 && (
              <div className="flex justify-end border-t pt-3 text-sm">
                <span className="text-muted-foreground">Total labour cost:</span>
                <span className="ml-2 font-semibold tabular-nums">{f.money(labourCost)}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Unpaid wages go to each labourer&apos;s ledger.</p>
          </CardContent>
        </Card>

        {/* Payment to party */}
        <Card>
          <CardHeader>
            <CardTitle>Payment to party</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Paid now" htmlFor="amountPaid" error={errors.amountPaid?.message}>
              <div className="flex gap-2">
                <Input id="amountPaid" type="number" step="0.01" min="0" inputMode="decimal" {...form.register("amountPaid")} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.setValue("amountPaid", Math.max(dueToParty, 0), { shouldValidate: true })}
                >
                  Full
                </Button>
              </div>
            </Field>
            <Field label="Method" htmlFor="paymentMethod">
              <NativeSelect id="paymentMethod" className="w-full" {...form.register("paymentMethod")}>
                <NativeSelectOption value="CASH">Cash</NativeSelectOption>
                <NativeSelectOption value="BANK">Bank</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field label="Remaining to party ledger">
              <Input value={f.money(remaining)} readOnly className={cn("bg-muted font-semibold", remaining < 0 && "text-destructive")} />
            </Field>
            <Field label="Notes" htmlFor="notes" className="sm:col-span-3">
              <Textarea id="notes" rows={2} {...form.register("notes")} />
            </Field>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Net weight" value={f.weight(net)} />
            <Row label="Purchase amount" value={f.money(amountValue)} />
            <Row
              label={`Truck rent${rentPaidBy === "PARTY" ? " (party pays)" : rentPaidBy === "DEDUCT" ? " (deducted)" : ""}`}
              value={f.money(rent)}
              muted={rentPaidBy !== "ME"}
            />
            <Row label="Labour cost" value={f.money(labourCost)} />
            <Separator />
            <Row label="Grand total" value={f.money(grandTotal)} strong />
            <p className="text-xs text-muted-foreground">
              Purchase + labour{rentPaidBy === "ME" ? " + truck rent" : ""} — your total cost for this truck.
            </p>
            <Separator />
            <Row label="Due to party" value={f.money(dueToParty)} />
            <Row label="Paid now" value={f.money(paid)} />
            <Row label="To party ledger" value={f.money(remaining)} strong />
          </CardContent>
        </Card>
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" size="lg" disabled={save.isPending}>
            {save.isPending ? "Saving…" : purchase ? "Update purchase" : "Save purchase"}
          </Button>
        </div>
      </div>
    </form>
  )
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-2", muted && "text-muted-foreground")}>
      <span className={cn(!strong && "text-muted-foreground")}>{label}</span>
      <span className={cn("tabular-nums", strong && "text-base font-semibold")}>{value}</span>
    </div>
  )
}
