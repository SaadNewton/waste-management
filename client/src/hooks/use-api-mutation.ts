import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { errorMessage } from "@/lib/api"

/**
 * Mutation with success/error toasts. Invalidates the given query-key roots on
 * success. Financial writes invalidate everything because ledgers, daybook and
 * dashboard all derive from them.
 */
export function useApiMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { success?: string | ((r: TResult) => string); invalidate?: string[] | "all"; onSuccess?: (r: TResult) => void } = {},
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      if (opts.invalidate === "all") await qc.invalidateQueries()
      else for (const key of opts.invalidate ?? []) await qc.invalidateQueries({ queryKey: [key] })
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(result) : opts.success)
      opts.onSuccess?.(result)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
}
