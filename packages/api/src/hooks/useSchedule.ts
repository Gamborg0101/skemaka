import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Schedule, Shift, ApiResult } from "@skemaka/types"
import { useApiClient } from "../context"

export function useSchedule(orgId: string, week: string) {
  const client = useApiClient()
  return useQuery({
    queryKey: ["schedule", orgId, week],
    queryFn: () =>
      client.get<ApiResult<Schedule>>(`/api/orgs/${orgId}/schedules?weekStart=${week}`),
    enabled: Boolean(orgId && week),
    staleTime: 30_000,
  })
}

export function useCreateShift(orgId: string, scheduleId: string) {
  const client = useApiClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Shift>) =>
      client.post<ApiResult<Shift>>(
        `/api/orgs/${orgId}/schedules/${scheduleId}/shifts`,
        input,
      ),
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
