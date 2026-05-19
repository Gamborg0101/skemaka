import { useQuery } from "@tanstack/react-query"
import { useApiClient, getMyShifts } from "@skemaka/api"
import { useAuthStore } from "@/store/authStore"
import { currentWeek } from "@/lib/dates"

export function useMyShifts(weekStart?: string) {
  const client = useApiClient()
  const { orgId, employee } = useAuthStore()
  const week = weekStart ?? currentWeek()

  return useQuery({
    queryKey:  ["shifts", orgId, employee?.id, week],
    queryFn:   () => getMyShifts(client, orgId!, week, employee!.id),
    enabled:   Boolean(orgId && employee?.id),
    staleTime: 5 * 60_000,
    gcTime:    15 * 60_000,
  })
}
