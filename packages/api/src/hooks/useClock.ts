import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { TimeEntry } from "@skemaka/types"
import { useApiClient } from "../context"

export function useActiveEntry(orgId: string, employeeId: string) {
  const client = useApiClient()
  return useQuery({
    queryKey: ["clock-active", orgId, employeeId],
    queryFn: async () => {
      const res = await client.get<{ data: TimeEntry | null }>(
        `/api/orgs/${orgId}/time-entries/active?employeeId=${employeeId}`,
      )
      return res.data ?? null
    },
    enabled: Boolean(orgId && employeeId),
    // Only poll when there is an active entry — stops unnecessary requests
    // when the employee is not clocked in.
    refetchInterval: (query) => (query.state.data ? 30_000 : false),
  })
}

export function useClockIn(orgId: string) {
  const client = useApiClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { employeeId: string; shiftId?: string; note?: string }) => {
      const res = await client.post<{ data: TimeEntry }>(`/api/orgs/${orgId}/time-entries`, input)
      return res.data
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ["clock-active", orgId, vars.employeeId] })
      void qc.invalidateQueries({ queryKey: ["time-entries", orgId] })
    },
  })
}

export function useClockOut(orgId: string) {
  const client = useApiClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { employeeId: string; breakMinutes?: number; note?: string }) => {
      const res = await client.patch<{ data: TimeEntry }>(`/api/orgs/${orgId}/time-entries/active`, input)
      return res.data
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ["clock-active", orgId, vars.employeeId] })
      void qc.invalidateQueries({ queryKey: ["time-entries", orgId] })
    },
  })
}
