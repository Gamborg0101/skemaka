import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  useApiClient,
  getSchedule,
  getOrCreateSchedule,
  createManagedShift,
  updateManagedShift,
  deleteManagedShift,
  listEmployees,
  type ShiftInput,
} from "@skemaka/api"
import { useAuthStore } from "@/store/authStore"

export function useManagerSchedule(weekStart: string) {
  const client = useApiClient()
  const { orgId } = useAuthStore()
  const qc = useQueryClient()

  const scheduleQuery = useQuery({
    queryKey: ["schedule", orgId, weekStart],
    queryFn: () => getSchedule(client, orgId!, weekStart),
    enabled: Boolean(orgId && weekStart),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })

  const ensureSchedule = useMutation({
    mutationFn: () => getOrCreateSchedule(client, orgId!, weekStart),
    onSuccess: (schedule) => {
      qc.setQueryData(["schedule", orgId, weekStart], schedule)
    },
  })

  const addShift = useMutation({
    mutationFn: (vars: { scheduleId: string; input: ShiftInput }) =>
      createManagedShift(client, orgId!, vars.scheduleId, vars.input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["schedule", orgId, weekStart] }),
  })

  const editShift = useMutation({
    mutationFn: (vars: { scheduleId: string; shiftId: string; input: Partial<ShiftInput> }) =>
      updateManagedShift(client, orgId!, vars.scheduleId, vars.shiftId, vars.input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["schedule", orgId, weekStart] }),
  })

  const removeShift = useMutation({
    mutationFn: (vars: { scheduleId: string; shiftId: string }) =>
      deleteManagedShift(client, orgId!, vars.scheduleId, vars.shiftId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["schedule", orgId, weekStart] }),
  })

  return {
    schedule: scheduleQuery.data ?? null,
    isLoading: scheduleQuery.isLoading,
    isFetching: scheduleQuery.isFetching,
    refetch: scheduleQuery.refetch,
    ensureSchedule,
    addShift,
    editShift,
    removeShift,
  }
}

export function useOrgEmployees() {
  const client = useApiClient()
  const { orgId } = useAuthStore()

  return useQuery({
    queryKey: ["employees", orgId],
    queryFn: () => listEmployees(client, orgId!),
    enabled: Boolean(orgId),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  })
}
