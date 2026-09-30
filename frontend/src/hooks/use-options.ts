import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Option } from "@/lib/types"

export function usePartyOptions(includeId?: string | null) {
  return useQuery({
    queryKey: ["parties", "options", includeId ?? null],
    queryFn: () => api.get<Option[]>("/parties/options", { includeId }),
  })
}

export function useLabourOptions(includeIds: string[] = []) {
  const key = [...new Set(includeIds)].sort().join(",")
  return useQuery({
    queryKey: ["labour", "options", key],
    queryFn: () => api.get<Option[]>("/labour/options", { includeIds: key }),
  })
}

export function useCategoryOptions() {
  return useQuery({
    queryKey: ["expense-categories", "options"],
    queryFn: () => api.get<Option[]>("/expense-categories/options"),
  })
}
