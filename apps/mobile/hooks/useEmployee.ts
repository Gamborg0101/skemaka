import { useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useApiClient, getCurrentUser, deleteAccount } from "@skemaka/api"
import { useAuthStore } from "@/store/authStore"
import { setTimeFormat } from "@/lib/timeFormat"

export function useCurrentUser() {
  const client = useApiClient()
  const { orgId, setEmployee } = useAuthStore()

  const query = useQuery({
    queryKey:  ["me", orgId],
    queryFn:   () => getCurrentUser(client, orgId!),
    enabled:   Boolean(orgId),
    staleTime: 5 * 60_000,
    gcTime:    10 * 60_000,
  })

  // Sync profile into auth store. Using useEffect (not inside queryFn) ensures
  // the sync runs on cache hits too, not only when the network request fires.
  useEffect(() => {
    if (!query.data) return
    setEmployee({
      id:      query.data.id,
      name:    query.data.name,
      email:   query.data.email,
      jobRole: query.data.jobRole,
      phone:   query.data.phone,
    })
    setTimeFormat(query.data.timeFormat ?? "24h")
  }, [query.data, setEmployee])

  return query
}

/**
 * Permanently deletes the signed-in user's account (Guideline 5.1.1(v)).
 * On success the React Query cache is cleared so no stale data lingers; the
 * caller is responsible for signing out. A 409 (sole manager) surfaces as an
 * `ApiError` with a human-readable message for the caller to display.
 */
export function useDeleteAccount() {
  const client = useApiClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: () => deleteAccount(client),
    onSuccess: () => {
      qc.clear()
    },
  })
}
