import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useApiClient, getCurrentUser } from "@skemaka/api"
import { useAuthStore } from "@/store/authStore"

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
  }, [query.data, setEmployee])

  return query
}
