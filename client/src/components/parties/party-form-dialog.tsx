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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import { useApiMutation } from "@/hooks/use-api-mutation"
import { api } from "@/lib/api"
import type { Party } from "@/lib/types"
import { amount, optionalString } from "@/lib/zod"

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: optionalString,
  address: optionalString,
  cnic: optionalString,
  openingBalance: amount("Opening balance"),
  openingType: z.enum(["DR", "CR"]),
  notes: optionalString,
  isActive: z.boolean(),
})
type Input = z.input<typeof schema>
type Output = z.output<typeof schema>

const empty: Input = { name: "", phone: "", address: "", cnic: "", openingBalance: 0, openingType: "CR", notes: "", isActive: true }

export function PartyFormDialog({
  open,
  onOpenChange,
  party,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  party?: Party | null
  onSaved?: (party: Party) => void
}) {
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(schema), defaultValues: empty })
  const { errors } = form.formState

  useEffect(() => {
    if (!open) return
    form.reset(
      party
        ? {
            name: party.name,
            phone: party.phone ?? "",
            address: party.address ?? "",
            cnic: party.cnic ?? "",
            openingBalance: party.openingBalance,
            openingType: party.openingType,
            notes: party.notes ?? "",
            isActive: party.isActive,
          }
        : empty,
    )
  }, [open, party, form])

  const save = useApiMutation(
    (values: Output) => (party ? api.put<Party>(`/parties/${party.id}`, values) : api.post<Party>("/parties", values)),
    {
      success: party ? "Party updated" : "Party added",
      invalidate: ["parties", "ledger", "dashboard"],
      onSuccess: (p) => {
        onOpenChange(false)
        onSaved?.(p)
      },
    },
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{party ? "Edit party" : "Add party"}</DialogTitle>
        </DialogHeader>
        <form id="party-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Name" htmlFor="name" required error={errors.name?.message} className="sm:col-span-2">
            <Input id="name" autoFocus {...form.register("name")} aria-invalid={!!errors.name} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" inputMode="tel" {...form.register("phone")} />
          </Field>
          <Field label="CNIC / ID" htmlFor="cnic" error={errors.cnic?.message}>
            <Input id="cnic" placeholder="Optional" {...form.register("cnic")} />
          </Field>
          <Field label="Address" htmlFor="address" className="sm:col-span-2">
            <Input id="address" {...form.register("address")} />
          </Field>
          <Field
            label="Opening balance"
            htmlFor="openingBalance"
            error={errors.openingBalance?.message}
            hint="Cr = you owe the party · Dr = party owes you"
          >
            <Input id="openingBalance" type="number" step="0.01" min="0" inputMode="decimal" {...form.register("openingBalance")} />
          </Field>
          <Field label="Balance type" htmlFor="openingType">
            <NativeSelect id="openingType" className="w-full" {...form.register("openingType")}>
              <NativeSelectOption value="CR">Cr — payable to party</NativeSelectOption>
              <NativeSelectOption value="DR">Dr — receivable / advance</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" rows={2} {...form.register("notes")} />
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
          <Button type="submit" form="party-form" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
