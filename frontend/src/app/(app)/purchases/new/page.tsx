import { PageHeader } from "@/components/shared/page-header"
import { PurchaseForm } from "@/components/purchases/purchase-form"

export default function NewPurchasePage() {
  return (
    <>
      <PageHeader title="New purchase" description="Record a truck arrival" />
      <PurchaseForm />
    </>
  )
}
