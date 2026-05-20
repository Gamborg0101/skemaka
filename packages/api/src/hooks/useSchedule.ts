import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Schedule, Shift } from "@skemaka/types"
import { useApiClient } from "../context"

export function useSchedule(orgId: string, week: string) {
  const client = useApiClient()
  return useQuery({
    queryKey: ["schedule", orgId, week],
    queryFn: async () => {
      const res = await client.get<{ data: Schedule | null }>(`/api/orgs/${orgId}/schedules?weekStart=${week}`)
      return res.data ?? null
    },
    enabled: Boolean(orgId && week),
    staleTime: 30_000,
  })
}

export function useCreateShift(orgId: string, scheduleId: string) {
  const client = useApiClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Shift>) => {
      const res = await client.post<{ data: Shift }>(
        `/api/orgs/${orgId}/schedules/${scheduleId}/shifts`,
        input,
      )
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["schedule", orgId] })
    },
  })
}

export function useDeleteShift(orgId: string, scheduleId: string) {
  const client = useApiClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (shiftId: string) =>
      client.del(`/api/orgs/${orgId}/schedules/${scheduleId}/shifts/${shiftId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["schedule", orgId] })
    },
  })
}
