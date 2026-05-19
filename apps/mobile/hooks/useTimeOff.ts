import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useApiClient, getMyTimeOff, submitTimeOffRequest } from "@skemaka/api"
import type { TimeOffInput } from "@skemaka/api"
import { useAuthStore } from "@/store/authStore"
import type { TimeOffRequest } from "@skemaka/types"

export function useMyTimeOff() {
  const client = useApiClient()
  const { orgId, employee } = useAuthStore()

  return useQuery({
    queryKey:  ["time-off", orgId, employee?.id],
    queryFn:   () => getMyTimeOff(client, orgId!, employee!.id),
    enabled:   Boolean(orgId && employee?.id),
    staleTime: 60_000,
  })
}

export function useSubmitTimeOff() {
  const client = useApiClient()
  const qc = useQueryClient()
  const { orgId, employee } = useAuthStore()
  const queryKey = ["time-off", orgId, employee?.id] as const

  return useMutation({
    mutationFn: (input: Omit<TimeOffInput, "employeeId">) =>
      submitTimeOffRequest(client, orgId!, { ...input, employeeId: employee!.id }),

    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<TimeOffRequest[]>(queryKey)

      qc.setQueryData<TimeOffRequest[]>(queryKey, (old = []) => [
        {
          id:             `optimistic-${Date.now()}`,
          organizationId: orgId!,
          employeeId:     employee!.id,
          startDate:      input.startDate,
          endDate:        input.endDate,
          reason:         input.reason ?? null,
          status:         "PENDING",
          reviewNote:     null,
          createdAt:      new Date().toISOString(),
          updatedAt:      new Date().toISOString(),
        },
        ...old,
      ])
      return { previous }
    },

    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(queryKey, ctx.previous)
      }
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey })
    },
  })
}
