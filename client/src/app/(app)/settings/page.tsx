"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { z } from "zod"
import { Pencil, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { DataTable, type Column } from "@/components/shared/data-table"
import { Field } from "@/components/shared/field"
import { PageHeader } from "@/components/shared/page-header"
import { useApiMutation } from "@/hooks/use-api-mutation"
import { useSettings } from "@/hooks/use-settings"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { Paged, User } from "@/lib/types"
import { amount, optionalString } from "@/lib/zod"

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-5">
        {isAdmin && <BusinessSettings />}
        <ChangePassword />
        {isAdmin && <UsersSection />}
      </div>
    </>
  )
}

const settingsSchema = z.object({
  businessName: z.string().trim().min(1, "Required"),
  address: optionalString,
  phone: optionalString,
  currency: z.string().trim().min(1, "Required").max(10),
  openingCash: amount("Opening cash"),
  openingBank: amount("Opening bank"),
})

function BusinessSettings() {
  const { data } = useSettings()
  const form = useForm<z.input<typeof settingsSchema>, unknown, z.output<typeof settingsSchema>>({ resolver: zodResolver(settingsSchema) })
  const { errors } = form.formState
  useEffect(() => {
    if (data) form.reset({ ...data, address: data.address ?? "", phone: data.phone ?? "" })
  }, [data, form])
  const save = useApiMutation((v: z.output<typeof settingsSchema>) => api.put("/settings", v), { success: "Settings saved", invalidate: "all" })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business</CardTitle>
        <CardDescription>Shown on slips and reports. Opening balances are the starting point for the daybook.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" noValidate>
          <Field label="Business name" htmlFor="s-name" required error={errors.businessName?.message}>
            <Input id="s-name" {...form.register("businessName")} />
          </Field>
          <Field label="Phone" htmlFor="s-phone">
            <Input id="s-phone" {...form.register("phone")} />
          </Field>
          <Field label="Address" htmlFor="s-address">
            <Input id="s-address" {...form.register("address")} />
          </Field>
          <Field label="Currency" htmlFor="s-currency" required error={errors.currency?.message} hint="e.g. PKR, Rs, USD">
            <Input id="s-currency" {...form.register("currency")} />
          </Field>
          <Field label="Opening cash balance" htmlFor="s-cash" error={errors.openingCash?.message}>
            <Input id="s-cash" type="number" step="0.01" min="0" {...form.register("openingCash")} />
          </Field>
          <Field label="Opening bank balance" htmlFor="s-bank" error={errors.openingBank?.message}>
            <Input id="s-bank" type="number" step="0.01" min="0" {...form.register("openingBank")} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: z.string().min(6, "At least 6 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords do not match" })

function ChangePassword() {
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  })
  const { errors } = form.formState
  const save = useApiMutation(
    (v: z.infer<typeof passwordSchema>) => api.post("/auth/change-password", { currentPassword: v.currentPassword, newPassword: v.newPassword }),
    { success: "Password changed", onSuccess: () => form.reset() },
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-3" noValidate>
          <Field label="Current password" htmlFor="p-cur" error={errors.currentPassword?.message}>
            <Input id="p-cur" type="password" autoComplete="current-password" {...form.register("currentPassword")} />
          </Field>
          <Field label="New password" htmlFor="p-new" error={errors.newPassword?.message}>
            <Input id="p-new" type="password" autoComplete="new-password" {...form.register("newPassword")} />
          </Field>
          <Field label="Confirm new password" htmlFor="p-conf" error={errors.confirm?.message}>
            <Input id="p-conf" type="password" autoComplete="new-password" {...form.register("confirm")} />
          </Field>
          <div className="sm:col-span-3">
            <Button type="submit" variant="outline" disabled={save.isPending}>
              Update password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function UsersSection() {
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  const { data, isFetching } = useQuery({
    queryKey: ["users", page],
    queryFn: () => api.get<Paged<User>>("/users", { page, pageSize: 20, sortOrder: "asc" }),
    placeholderData: keepPreviousData,
  })
  const columns: Column<User>[] = [
    { key: "name", header: "Name", cell: (u) => <span className="font-medium">{u.name}</span> },
    { key: "email", header: "Email", cell: (u) => u.email },
    { key: "role", header: "Role", cell: (u) => <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>{u.role === "ADMIN" ? "Admin" : "Staff"}</Badge> },
    { key: "status", header: "Status", cell: (u) => (u.isActive ? "Active" : "Inactive"), hideOnMobile: true },
    {
      key: "edit",
      header: "",
      align: "right",
      cell: (u) => (
        <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => { setEditing(u); setOpen(true) }}>
          <Pencil />
        </Button>
      ),
    },
  ]
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Users</CardTitle>
          <CardDescription>Admins can delete records and manage settings. Staff can add and edit.</CardDescription>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true) }}>
          <Plus /> Add user
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} rows={data?.data} loading={isFetching} rowKey={(u) => u.id} meta={data?.meta} onPageChange={setPage} />
      </CardContent>
      <UserDialog open={open} onOpenChange={setOpen} user={editing} />
    </Card>
  )
}

const userSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  email: z.string().trim().email("Invalid email"),
  password: z.string(),
  role: z.enum(["ADMIN", "STAFF"]),
  isActive: z.boolean(),
})
type UserValues = z.infer<typeof userSchema>

function UserDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (o: boolean) => void; user: User | null }) {
  const form = useForm<UserValues>({
    resolver: zodResolver(
      userSchema.refine((v) => (user ? !v.password || v.password.length >= 6 : v.password.length >= 6), {
        path: ["password"],
        message: "At least 6 characters",
      }),
    ),
  })
  const { errors } = form.formState
  useEffect(() => {
    if (open) form.reset({ name: user?.name ?? "", email: user?.email ?? "", password: "", role: user?.role ?? "STAFF", isActive: user?.isActive ?? true })
  }, [open, user, form])
  const save = useApiMutation((v: UserValues) => (user ? api.put(`/users/${user.id}`, v) : api.post("/users", v)), {
    success: user ? "User updated" : "User added",
    invalidate: ["users"],
    onSuccess: () => onOpenChange(false),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? "Edit user" : "Add user"}</DialogTitle>
        </DialogHeader>
        <form id="user-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4" noValidate>
          <Field label="Name" htmlFor="u-name" required error={errors.name?.message}>
            <Input id="u-name" {...form.register("name")} />
          </Field>
          <Field label="Email" htmlFor="u-email" required error={errors.email?.message}>
            <Input id="u-email" type="email" {...form.register("email")} />
          </Field>
          <Field label={user ? "New password" : "Password"} htmlFor="u-pass" required={!user} error={errors.password?.message} hint={user ? "Leave blank to keep the current password" : undefined}>
            <Input id="u-pass" type="password" autoComplete="new-password" {...form.register("password")} />
          </Field>
          <Field label="Role" htmlFor="u-role">
            <NativeSelect id="u-role" className="w-full" {...form.register("role")}>
              <NativeSelectOption value="STAFF">Staff</NativeSelectOption>
              <NativeSelectOption value="ADMIN">Admin</NativeSelectOption>
            </NativeSelect>
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
          <Button type="submit" form="user-form" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
