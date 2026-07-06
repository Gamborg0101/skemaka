import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  useApiClient,
  getMyCoverRequests,
  createCoverRequest,
  claimCoverRequest,
  cancelCoverRequest,
} from "@skemaka/api"
import { useAuthStore } from "@/store/authStore"

/** Open pool the employee can claim + their own requests/claims. */
export function useCoverRequests() {
  const client = useApiClient()
  const { orgId } = useAuthStore()

  return useQuery({
    queryKey:  ["cover", orgId],
    queryFn:   () => getMyCoverRequests(client, orgId!),
    enabled:   Boolean(orgId),
    staleTime: 30_000,
  })
}

function useInvalidateCover() {
  const qc = useQueryClient()
  const { orgId } = useAuthStore()
  return () => {
    void qc.invalidateQueries({ queryKey: ["cover", orgId] })
    void qc.invalidateQueries({ queryKey: ["shifts", orgId] })
  }
}

/** Offer one of my own shifts up for cover. */
export function useOfferCover() {
  const client = useApiClient()
  const { orgId } = useAuthStore()
  const invalidate = useInvalidateCover()

  return useMutation({
    mutationFn: ({ shiftId, note }: { shiftId: string; note?: string | null }) =>
      createCoverRequest(client, orgId!, shiftId, note ?? null),
    onSuccess: invalidate,
  })
}

/** Offer to cover an open request (pending manager approval). */
export function useClaimCover() {
  const client = useApiClient()
  const { orgId } = useAuthStore()
  const invalidate = useInvalidateCover()

  return useMutation({
    mutationFn: (requestId: string) => claimCoverRequest(client, orgId!, requestId),
    onSuccess: invalidate,
  })
}

/** Withdraw my own cover request. */
export function useCancelCover() {
  const client = useApiClient()
  const { orgId } = useAuthStore()
  const invalidate = useInvalidateCover()

  return useMutation({
    mutationFn: (requestId: string) => cancelCoverRequest(client, orgId!, requestId),
    onSuccess: invalidate,
  })
}
