import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  useApiClient,
  getOpenAvailabilityRequest,
  getMyAvailabilitySubmission,
  getAllAvailabilitySubmissions,
  submitAvailability,
} from "@skemaka/api"
import type { DayAvailability } from "@skemaka/api"
import { useAuthStore } from "@/store/authStore"

export function useOpenRequest(weekStart: string) {
  const client = useApiClient()
  const { orgId } = useAuthStore()

  return useQuery({
    queryKey:  ["availability/open", orgId, weekStart],
    queryFn:   () => getOpenAvailabilityRequest(client, orgId!, weekStart),
    enabled:   Boolean(orgId && weekStart),
    staleTime: 2 * 60_000,
  })
}

export function useMySubmission(requestId: string | undefined) {
  const client = useApiClient()
  const { orgId } = useAuthStore()

  return useQuery({
    queryKey: ["availability/my-submission", orgId, requestId],
    queryFn:  () => getMyAvailabilitySubmission(client, orgId!, requestId!),
    enabled:  Boolean(orgId && requestId),
    staleTime: 60_000,
  })
}

export function useAllSubmissions(requestId: string | undefined) {
  const client = useApiClient()
  const { orgId } = useAuthStore()

  return useQuery({
    queryKey:  ["availability/submissions/all", orgId, requestId],
    queryFn:   () => getAllAvailabilitySubmissions(client, orgId!, requestId!),
    enabled:   Boolean(orgId && requestId),
    staleTime: 60_000,
  })
}

export function useSubmitAvailability(requestId: string | undefined) {
  const client = useApiClient()
  const qc = useQueryClient()
  const { orgId } = useAuthStore()

  return useMutation({
    mutationFn: (days: DayAvailability[]) =>
      submitAvailability(client, orgId!, requestId!, days),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["availability/my-submission", orgId, requestId],
      })
      void qc.invalidateQueries({
        queryKey: ["availability/open", orgId],
      })
    },
  })
}
