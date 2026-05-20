import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  useApiClient,
  getOpenAvailabilityRequest,
  getMyAvailabilitySubmission,
  submitAvailability,
} from "@skemaka/api"
import type { DayAvailability } from "@skemaka/api"
import { useAuthStore } from "@/store/authStore"

export function useOpenRequest() {
  const client = useApiClient()
  const { orgId } = useAuthStore()

  return useQuery({
    queryKey:  ["availability/open", orgId],
    queryFn:   () => getOpenAvailabilityRequest(client, orgId!),
    enabled:   Boolean(orgId),
    staleTime: 2 * 60_000,
  })
}

export function useMySubmission(requestId: string | undefined) {
  const client = useApiClient()
  const { orgId, employee } = useAuthStore()

  return useQuery({
    queryKey: ["availability/submission", orgId, requestId, employee?.id],
    queryFn:  () => getMyAvailabilitySubmission(client, orgId!, requestId!, employee!.id),
    enabled:  Boolean(orgId && requestId && employee?.id),
    staleTime: 60_000,
  })
}

export function useSubmitAvailability(requestId: string | undefined) {
  const client = useApiClient()
  const qc = useQueryClient()
  const { orgId, employee } = useAuthStore()

  return useMutation({
    mutationFn: (days: DayAvailability[]) =>
      submitAvailability(client, orgId!, requestId!, days),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["availability/submission", orgId, requestId, employee?.id],
      })
      void qc.invalidateQueries({
        queryKey: ["availability/open", orgId],
      })
    },
  })
}
