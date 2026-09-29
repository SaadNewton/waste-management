"use client"

import { useEffect, useRef } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { Combobox } from "@/components/shared/combobox"
import { Field } from "@/components/shared/field"
import { useApiMutation } from "@/hooks/use-api-mutation"
import { useLabourOptions, usePartyOptions } from "@/hooks/use-options"
import { api } from "@/lib/api"
import { todayISO } from "@/lib/format"
import type { PayeeType, Payment } from "@/lib/types"
import { optionalString, positiveAmount } from "@/lib/zod"

const schema = z
  .object({
    date: z.string().min(1, "Date is required"),
    payeeType: z.enum(["PARTY", "LABOUR", "OTHER"]),
    direction: z.enum(["OUT", "IN"]),
    partyId: z.string().nullable(),
    labourId: z.string().nullable(),
    payeeName: optionalString,
    amount: positiveAmount(),
    method: z.enum(["CASH", "BANK"]),
    note: optionalString,
  })
  .superRefine((v, ctx) => {
    if (v.payeeType === "PARTY" && !v.partyId) ctx.addIssue({ code: "custom", path: ["partyId"], message: "Select a party" })
    if (v.payeeType === "LABOUR" && !v.labourId) ctx.addIssue({ code: "custom", path: ["labourId"], message: "Select a labourer" })
    if (v.payeeType === "OTHER" && !v.payeeName) ctx.addIssue({ code: "custom", path: ["payeeName"], message: "Enter a name" })
  })
type Input = z.input<typeof schema>
type Output = z.output<typeof schema>

export interface PaymentPreset {
  payeeType: PayeeType
  partyId?: string
  labourId?: string
  amount?: number
}

export function PaymentFormDialog({
  open,
  onOpenChange,
  payment,
  preset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment?: Payment | null
  preset?: PaymentPreset
}) {
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(schema) })
  const { errors } = form.formState
  const payeeType = form.watch("payeeType")
  const direction = form.watch("direction")
  const parties = usePartyOptions(payment?.partyId)
  const labour = useLabourOptions(payment?.labourId ? [payment.labourId] : [])

  // Read the preset through a ref so an inline object from the parent doesn't re-trigger the reset.
  const presetRef = useRef(preset)
  presetRef.current = preset

  useEffect(() => {
    if (!open) return
    const preset = presetRef.current
    form.reset(
      payment
        ? {
            date: payment.date.slice(0, 10),
            payeeType: payment.payeeType,
            direction: payment.direction,
            partyId: payment.partyId,
            labourId: payment.labourId,
            payeeName: payment.payeeName ?? "",
            amount: payment.amount,
            method: payment.method,
            note: payment.note ?? "",
          }
        : {
            date: todayISO(),
            payeeType: preset?.payeeType ?? "PARTY",
            direction: "OUT",
            partyId: preset?.partyId ?? null,
            labourId: preset?.labourId ?? null,
            payeeName: "",
            amount: preset?.amount && preset.amount > 0 ? preset.amount : ("" as unknown as number),
            method: "CASH",
            note: "",
          },
    )
  }, [open, payment, form])

  const save = useApiMutation(
    (v: Output) => (payment ? api.put<Payment>(`/payments/${payment.id}`, v) : api.post<Payment>("/payments", v)),
    {
      success: (p) => (payment ? `Voucher ${p.voucherNo} updated` : `Voucher ${p.voucherNo} saved`),
      invalidate: "all",
      onSuccess: () => onOpenChange(false),
    },
  )

  const lockedPayee = !!preset && !payment
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{payment ? `Edit ${payment.voucherNo}` : direction === "IN" ? "Record receipt" : "Record payment"}</DialogTitle>
          <DialogDescription>Posts to the ledger and the cash/bank book.</DialogDescription>
        </DialogHeader>
        <form id="payment-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Date" htmlFor="pay-date" required error={errors.date?.message}>
            <Input id="pay-date" type="date" {...form.register("date")} />
          </Field>
          <Field label="Type" htmlFor="pay-direction">
            <NativeSelect id="pay-direction" className="w-full" {...form.register("direction")}>
              <NativeSelectOption value="OUT">Payment (money out)</NativeSelectOption>
              <NativeSelectOption value="IN">Receipt (money in)</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field label="Payee type" htmlFor="pay-payeeType">
            <NativeSelect id="pay-payeeType" className="w-full" disabled={lockedPayee} {...form.register("payeeType")}>
              <NativeSelectOption value="PARTY">Party</NativeSelectOption>
              <NativeSelectOption value="LABOUR">Labour</NativeSelectOption>
              <NativeSelectOption value="OTHER">Other</NativeSelectOption>
            </NativeSelect>
          </Field>
          {payeeType === "PARTY" && (
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
                    disabled={lockedPayee}
                    invalid={!!errors.partyId}
                  />
                )}
              />
            </Field>
          )}
          {payeeType === "LABOUR" && (
            <Field label="Labour" required error={errors.labourId?.message}>
              <Controller
                control={form.control}
                name="labourId"
                render={({ field }) => (
                  <Combobox
                    options={(labour.data ?? []).map((l) => ({ value: l.id, label: l.name }))}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select labourer"
                    disabled={lockedPayee}
                    invalid={!!errors.labourId}
                  />
                )}
              />
            </Field>
          )}
          {payeeType === "OTHER" && (
            <Field label={direction === "IN" ? "Received from" : "Paid to"} htmlFor="pay-name" required error={errors.payeeName?.message}>
              <Input id="pay-name" {...form.register("payeeName")} />
            </Field>
          )}
          <Field label="Amount" htmlFor="pay-amount" required error={errors.amount?.message}>
            <Input id="pay-amount" type="number" step="0.01" min="0" inputMode="decimal" {...form.register("amount")} />
          </Field>
          <Field label="Method" htmlFor="pay-method">
            <NativeSelect id="pay-method" className="w-full" {...form.register("method")}>
              <NativeSelectOption value="CASH">Cash</NativeSelectOption>
              <NativeSelectOption value="BANK">Bank</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field label="Note" htmlFor="pay-note" className="sm:col-span-2">
            <Textarea id="pay-note" rows={2} {...form.register("note")} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
