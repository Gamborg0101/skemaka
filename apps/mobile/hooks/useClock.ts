import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useApiClient, getActiveEntry, clockIn, clockOut, updateTimeEntry } from "@skemaka/api"
import type { ClockInOptions, ClockOutOptions, UpdateTimeEntryInput } from "@skemaka/api"
import { useAuthStore } from "@/store/authStore"

const ACTIVE_KEY = (orgId: string) => ["clock/active", orgId]

// Managers need to pass their own employeeId when clocking in/out — the
// server requires an employeeId body/query param for any MANAGER-role JWT.
// Returns undefined for plain employees (server resolves from JWT instead).
function useManagerEmployeeId(): string | undefined {
  const { role, employee } = useAuthStore()
  const isManager = role === "MANAGER" || role === "ADMIN"
  return isManager ? (employee?.id ?? undefined) : undefined
}

function useIsManager(): boolean {
  const { role } = useAuthStore()
  return role === "MANAGER" || role === "ADMIN"
}

export function useActiveEntry() {
  const client = useApiClient()
  const { orgId } = useAuthStore()
  const isManager = useIsManager()
  const managerEmployeeId = useManagerEmployeeId()

  // For managers, wait until the employee profile is loaded so we have
  // their employeeId — without it the server returns 400.
  const enabled = Boolean(orgId) && (!isManager || Boolean(managerEmployeeId))

  return useQuery({
    queryKey:        ACTIVE_KEY(orgId ?? ""),
    queryFn:         () => getActiveEntry(client, orgId!, managerEmployeeId),
    enabled,
    // Only poll when there is an active entry — no need to hit the server
    // every 30s just to confirm the user is still not clocked in.
    refetchInterval: (query) => (query.state.data ? 30_000 : false),
    staleTime:       0,
  })
}

export function useClockIn() {
  const client = useApiClient()
  const qc = useQueryClient()
  const { orgId } = useAuthStore()
  const isManager = useIsManager()
  const managerEmployeeId = useManagerEmployeeId()

  return useMutation({
    mutationFn: (opts?: ClockInOptions) => {
      if (isManager && !managerEmployeeId) {
        return Promise.reject(new Error("Your employee profile hasn't loaded yet. Please wait a moment and try again."))
      }
      return clockIn(client, orgId!, { ...opts, ...(managerEmployeeId ? { employeeId: managerEmployeeId } : {}) })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ACTIVE_KEY(orgId ?? "") })
    },
  })
}

export function useClockOut() {
  const client = useApiClient()
  const qc = useQueryClient()
  const { orgId } = useAuthStore()
  const isManager = useIsManager()
  const managerEmployeeId = useManagerEmployeeId()

  return useMutation({
    mutationFn: (opts?: ClockOutOptions) => {
      if (isManager && !managerEmployeeId) {
        return Promise.reject(new Error("Your employee profile hasn't loaded yet. Please wait a moment and try again."))
      }
      return clockOut(client, orgId!, { ...opts, ...(managerEmployeeId ? { employeeId: managerEmployeeId } : {}) })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ACTIVE_KEY(orgId ?? "") })
    },
  })
}

export function useUpdateTimeEntry() {
  const client = useApiClient()
  const { orgId } = useAuthStore()

  return useMutation({
    mutationFn: ({ entryId, input }: { entryId: string; input: UpdateTimeEntryInput }) =>
      updateTimeEntry(client, orgId!, entryId, input),
  })
}
