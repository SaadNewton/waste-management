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
import type { ExpenseCategory } from "@/lib/types"
import { optionalString } from "@/lib/zod"

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  description: optionalString,
  isActive: z.boolean(),
})
type Input = z.input<typeof schema>
type Output = z.output<typeof schema>

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: ExpenseCategory | null
}) {
  const form = useForm<Input, unknown, Output>({ resolver: zodResolver(schema) })
  const { errors } = form.formState

  useEffect(() => {
    if (!open) return
    form.reset({ name: category?.name ?? "", description: category?.description ?? "", isActive: category?.isActive ?? true })
  }, [open, category, form])

  const save = useApiMutation(
    (v: Output) => (category ? api.put(`/expense-categories/${category.id}`, v) : api.post("/expense-categories", v)),
    { success: category ? "Category updated" : "Category added", invalidate: ["expense-categories", "expenses"], onSuccess: () => onOpenChange(false) },
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "Add category"}</DialogTitle>
        </DialogHeader>
        <form id="category-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4" noValidate>
          <Field label="Name" htmlFor="c-name" required error={errors.name?.message}>
            <Input id="c-name" autoFocus {...form.register("name")} />
          </Field>
          <Field label="Description" htmlFor="c-desc">
            <Input id="c-desc" {...form.register("description")} />
          </Field>
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox checked={form.watch("isActive")} onCheckedChange={(v) => form.setValue("isActive", v === true)} />
            Active
          </Label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
