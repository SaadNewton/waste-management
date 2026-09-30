"use client"

import { use } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/page-header"
import { PurchaseForm } from "@/components/purchases/purchase-form"
import { api } from "@/lib/api"
import type { Purchase } from "@/lib/types"

export default function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, error } = useQuery({
    queryKey: ["purchases", "detail", id],
    queryFn: () => api.get<Purchase>(`/purchases/${id}`),
    staleTime: 0,
  })
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>
  return (
    <>
      <PageHeader
        title={`Edit ${data.purchaseNo}`}
        description="Saving reverses the original ledger entries and posts the new ones."
      />
      <PurchaseForm purchase={data} />
    </>
  )
}
