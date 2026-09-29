"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Field } from "@/components/shared/field"
import { useApiMutation } from "@/hooks/use-api-mutation"
import { api } from "@/lib/api"
import type { Labour } from "@/lib/types"
import { optionalAmount, optionalString } from "@/lib/zod"

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: optionalString,
  address: optionalString,
  defaultWage: optionalAmount,
  isActive: z.boolean(),
})
type Input = z.input<typeof schema>
type Output = z.output<typeof schema>

const empty: Input = { name: "", phone: "", address: "", defaultWage: "", isActive: true }

export function LabourFormDialog({
  open,
  onOpenChange,
  labour,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  labour?: Labour | null
}) {
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(schema), defaultValues: empty })
  const { errors } = form.formState

  useEffect(() => {
    if (!open) return
    form.reset(
      labour
        ? {
            name: labour.name,
            phone: labour.phone ?? "",
            address: labour.address ?? "",
            defaultWage: labour.defaultWage ?? "",
            isActive: labour.isActive,
          }
        : empty,
    )
  }, [open, labour, form])

  const save = useApiMutation(
    (v: Output) => (labour ? api.put<Labour>(`/labour/${labour.id}`, v) : api.post<Labour>("/labour", v)),
    { success: labour ? "Labour updated" : "Labour added", invalidate: ["labour"], onSuccess: () => onOpenChange(false) },
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labour ? "Edit labour" : "Add labour"}</DialogTitle>
        </DialogHeader>
        <form id="labour-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Name" htmlFor="l-name" required error={errors.name?.message} className="sm:col-span-2">
            <Input id="l-name" autoFocus {...form.register("name")} aria-invalid={!!errors.name} />
          </Field>
          <Field label="Phone" htmlFor="l-phone">
            <Input id="l-phone" inputMode="tel" {...form.register("phone")} />
          </Field>
          <Field label="Default wage" htmlFor="l-wage" error={errors.defaultWage?.message} hint="Pre-fills the wage on purchases">
            <Input id="l-wage" type="number" step="0.01" min="0" inputMode="decimal" {...form.register("defaultWage")} />
          </Field>
          <Field label="Address" htmlFor="l-address" className="sm:col-span-2">
            <Input id="l-address" {...form.register("address")} />
          </Field>
          <Label className="flex items-center gap-2 font-normal sm:col-span-2">
            <Checkbox checked={form.watch("isActive")} onCheckedChange={(v) => form.setValue("isActive", v === true)} />
            Active
          </Label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="labour-form" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
