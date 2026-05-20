import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { TimeOffRequest } from "@skemaka/types"
import { useApiClient } from "../context"

export function useTimeOff(orgId: string, filters?: { status?: string; employeeId?: string }) {
  const client = useApiClient()
  const params = new URLSearchParams()
  if (filters?.status)     params.set("status", filters.status)
  if (filters?.employeeId) params.set("employeeId", filters.employeeId)
  const qs = params.toString() ? `?${params.toString()}` : ""

  return useQuery({
    queryKey: ["time-off", orgId, filters],
    queryFn: async () => {
      const res = await client.get<{ data: TimeOffRequest[] }>(`/api/orgs/${orgId}/time-off${qs}`)
      return res.data ?? []
    },
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
