"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Pencil, Printer, Trash2 } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { PurchaseSlip } from "@/components/purchases/purchase-slip"
import { useApiMutation } from "@/hooks/use-api-mutation"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import type { Purchase } from "@/lib/types"

export default function PurchaseViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { isAdmin } = useAuth()
  const [confirm, setConfirm] = useState(false)
  const { data, isLoading, error } = useQuery({
    queryKey: ["purchases", "detail", id],
    queryFn: () => api.get<Purchase>(`/purchases/${id}`),
  })
  const remove = useApiMutation(() => api.del(`/purchases/${id}`), {
    success: "Purchase deleted and ledger entries reversed",
    invalidate: "all",
    onSuccess: () => router.replace("/purchases"),
  })

  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <>
      <Link href="/purchases" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Purchases
      </Link>
      <PageHeader
        className="no-print"
        title={data.purchaseNo}
        description={`${formatDate(data.date)} · ${data.party.name} · ${data.vehicleNo}${data.createdBy ? ` · by ${data.createdBy.name}` : ""}`}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Print slip
            </Button>
            <Link href={`/purchases/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <Pencil /> Edit
            </Link>
            {isAdmin && (
              <Button variant="destructive" onClick={() => setConfirm(true)}>
                <Trash2 /> Delete
              </Button>
            )}
          </>
        }
      />
      <PurchaseSlip purchase={data} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${data.purchaseNo}?`}
        description="All ledger and cash-book entries created by this purchase will be reversed. This cannot be undone."
        loading={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </>
  )
}
