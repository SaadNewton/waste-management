"use client"

import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { Combobox } from "@/components/shared/combobox"
import { Field } from "@/components/shared/field"
import { useApiMutation } from "@/hooks/use-api-mutation"
import { useCategoryOptions } from "@/hooks/use-options"
import { api } from "@/lib/api"
import { todayISO } from "@/lib/format"
import type { Expense } from "@/lib/types"
import { optionalString, positiveAmount } from "@/lib/zod"

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  categoryId: z.string().nullable().refine((v) => v != null, "Category is required"),
  amount: positiveAmount(),
  paymentMethod: z.enum(["CASH", "BANK"]),
  paidTo: optionalString,
  description: optionalString,
})
type Input = z.input<typeof schema>
type Output = z.output<typeof schema>

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense?: Expense | null
}) {
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(schema) })
  const { errors } = form.formState
  const categories = useCategoryOptions()

  useEffect(() => {
    if (!open) return
    form.reset(
      expense
        ? {
            date: expense.date.slice(0, 10),
            categoryId: expense.categoryId,
            amount: expense.amount,
            paymentMethod: expense.paymentMethod,
            paidTo: expense.paidTo ?? "",
            description: expense.description ?? "",
          }
        : { date: todayISO(), categoryId: null, amount: "" as unknown as number, paymentMethod: "CASH", paidTo: "", description: "" },
    )
  }, [open, expense, form])

  const save = useApiMutation(
    (v: Output) => (expense ? api.put(`/expenses/${expense.id}`, v) : api.post("/expenses", v)),
    { success: expense ? "Expense updated" : "Expense added", invalidate: "all", onSuccess: () => onOpenChange(false) },
  )

  const options = (categories.data ?? [])
    .filter((c) => c.isActive || c.id === expense?.categoryId)
    .map((c) => ({ value: c.id, label: c.name }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle>
        </DialogHeader>
        <form id="expense-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Date" htmlFor="e-date" required error={errors.date?.message}>
            <Input id="e-date" type="date" {...form.register("date")} />
          </Field>
          <Field label="Category" required error={errors.categoryId?.message}>
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <Combobox options={options} value={field.value} onChange={field.onChange} placeholder="Select" invalid={!!errors.categoryId} />
              )}
            />
          </Field>
          <Field label="Amount" htmlFor="e-amount" required error={errors.amount?.message}>
            <Input id="e-amount" type="number" step="0.01" min="0" inputMode="decimal" {...form.register("amount")} />
          </Field>
          <Field label="Payment method" htmlFor="e-method">
            <NativeSelect id="e-method" className="w-full" {...form.register("paymentMethod")}>
              <NativeSelectOption value="CASH">Cash</NativeSelectOption>
              <NativeSelectOption value="BANK">Bank</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field label="Paid to" htmlFor="e-paidTo" className="sm:col-span-2">
            <Input id="e-paidTo" {...form.register("paidTo")} />
          </Field>
          <Field label="Description" htmlFor="e-desc" className="sm:col-span-2">
            <Textarea id="e-desc" rows={2} {...form.register("description")} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
