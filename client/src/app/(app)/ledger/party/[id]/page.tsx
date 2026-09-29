"use client"

import { use } from "react"
import { LedgerStatement } from "@/components/ledger/ledger-statement"

export default function PartyLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <LedgerStatement type="party" id={id} />
}
