import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { formatBalance, formatMoney, formatWeight } from "@/lib/format"
import type { Settings } from "@/lib/types"

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => api.get<Settings>("/settings"), staleTime: 5 * 60_000 })
}

/** Formatters bound to the configured currency and weight unit. */
export function useFormat() {
  const { data } = useSettings()
  const currency = data?.currency ?? "PKR"
  const unit = data?.weightUnit ?? "KG"
  return {
    currency,
    unit,
    money: (v: number | null | undefined) => formatMoney(v, currency),
    weight: (v: number | null | undefined) => formatWeight(v, unit),
    balance: (v: number) => formatBalance(v, currency),
  }
}
