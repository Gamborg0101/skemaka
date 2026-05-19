import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { TimeOffRequest, ApiResult } from "@skemaka/types"
import { useApiClient } from "../context"

export function useTimeOff(orgId: string, filters?: { status?: string; employeeId?: string }) {
  const client = useApiClient()
  const params = new URLSearchParams()
  if (filters?.status)     params.set("status", filters.status)
  if (filters?.employeeId) params.set("employeeId", filters.employeeId)
  const qs = params.toString() ? `?${params.toString()}` : ""

  return useQuery({
    queryKey: ["time-off", orgId, filters],
    queryFn: () =>
      client.get<ApiResult<TimeOffRequest[]>>(`/api/orgs/${orgId}/time-off${qs}`),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  })
}

export function useCreateTimeOff(orgId: string) {
  const client = useApiClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { employeeId: string; startDate: string; endDate: string; reason?: string }) =>
      client.post<ApiResult<TimeOffRequest>>(`/api/orgs/${orgId}/time-off`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["time-off", orgId] })
    },
  })
}

export function useReviewTimeOff(orgId: string) {
  const client = useApiClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, reviewNote }: { id: string; status: "APPROVED" | "DENIED"; reviewNote?: string }) =>
      client.patch<ApiResult<TimeOffRequest>>(`/api/orgs/${orgId}/time-off/${id}`, { status, reviewNote }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["time-off", orgId] })
    },
  })
}
