import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { TimeOffRequest } from "@skemaka/types"
import { useApiClient } from "../context"
import { listTimeOff, type TimeOffFilters } from "../api"

export function useTimeOff(orgId: string, filters?: TimeOffFilters) {
  const client = useApiClient()

  return useQuery({
    queryKey: ["time-off", orgId, filters],
    // Paged in full: the server defaults this endpoint to 50 per page, and
    // time-off rows accumulate, so a single request quietly truncated the list
    // long before an org grew to 50 staff.
    queryFn: () => listTimeOff(client, orgId, filters ?? {}),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  })
}

export function useCreateTimeOff(orgId: string) {
  const client = useApiClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { employeeId: string; startDate: string; endDate: string; reason?: string }) => {
      const res = await client.post<{ data: TimeOffRequest }>(`/api/orgs/${orgId}/time-off`, input)
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["time-off", orgId] })
    },
  })
}

export function useReviewTimeOff(orgId: string) {
  const client = useApiClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, reviewNote }: { id: string; status: "APPROVED" | "DENIED"; reviewNote?: string }) => {
      const res = await client.patch<{ data: TimeOffRequest }>(`/api/orgs/${orgId}/time-off/${id}`, { status, reviewNote })
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["time-off", orgId] })
    },
  })
}
