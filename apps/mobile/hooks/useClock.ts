import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useApiClient, getActiveEntry, clockIn, clockOut } from "@skemaka/api"
import type { ClockInOptions, ClockOutOptions } from "@skemaka/api"
import { useAuthStore } from "@/store/authStore"

const ACTIVE_KEY = (orgId: string) => ["clock/active", orgId]

export function useActiveEntry() {
  const client = useApiClient()
  const { orgId } = useAuthStore()

  return useQuery({
    queryKey:        ACTIVE_KEY(orgId ?? ""),
    queryFn:         () => getActiveEntry(client, orgId!),
    enabled:         Boolean(orgId),
    refetchInterval: 30_000,
    staleTime:       0,
  })
}

export function useClockIn() {
  const client = useApiClient()
  const qc = useQueryClient()
  const { orgId } = useAuthStore()

  return useMutation({
    mutationFn: (opts?: ClockInOptions) => clockIn(client, orgId!, opts),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ACTIVE_KEY(orgId ?? "") })
    },
  })
}

export function useClockOut() {
  const client = useApiClient()
  const qc = useQueryClient()
  const { orgId } = useAuthStore()

  return useMutation({
    mutationFn: (opts?: ClockOutOptions) => clockOut(client, orgId!, opts),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ACTIVE_KEY(orgId ?? "") })
    },
  })
}
