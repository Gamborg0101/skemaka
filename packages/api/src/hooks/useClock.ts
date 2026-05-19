import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { TimeEntry, ApiResult } from "@skemaka/types"
import { useApiClient } from "../context"

export function useActiveEntry(orgId: string, employeeId: string) {
  const client = useApiClient()
  return useQuery({
    queryKey: ["clock-active", orgId, employeeId],
    queryFn: () =>
      client.get<ApiResult<TimeEntry | null>>(
        `/api/orgs/${orgId}/time-entries/active?employeeId=${employeeId}`,
      ),
    enabled: Boolean(orgId && employeeId),
    refetchInterval: 30_000,
  })
}

export function useClockIn(orgId: string) {
  const client = useApiClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { employeeId: string; shiftId?: string; note?: string }) =>
      client.post<ApiResult<TimeEntry>>(`/api/orgs/${orgId}/time-entries`, input),
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
    mutationFn: (input: { employeeId: string; breakMinutes?: number; note?: string }) =>
      client.patch<ApiResult<TimeEntry>>(`/api/orgs/${orgId}/time-entries/active`, input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ["clock-active", orgId, vars.employeeId] })
      void qc.invalidateQueries({ queryKey: ["time-entries", orgId] })
    },
  })
}
