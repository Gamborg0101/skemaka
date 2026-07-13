import { useCallback } from "react"
import type { Dispatch, SetStateAction } from "react"
import { toast } from "sonner"
import type { Schedule, Shift } from "@/types"

export function useShiftMutations(
  schedule: Schedule | null,
  setSchedule: Dispatch<SetStateAction<Schedule | null>>,
  orgId: string,
  employees: Array<{ id: string; name: string }>,
  ensureSchedule: () => Promise<Schedule>,
) {
  const patchShift = useCallback((id: string, update: Partial<Shift>) => {
    setSchedule((s) => s ? { ...s, shifts: s.shifts?.map((sh) => sh.id === id ? { ...sh, ...update } : sh) } : s)
  }, [setSchedule])

  const rollbackShift = useCallback((id: string, prev: Shift | undefined) => {
    if (!prev) return
    setSchedule((s) => s ? { ...s, shifts: s.shifts?.map((sh) => sh.id === id ? prev : sh) } : s)
  }, [setSchedule])

  const deleteShift = useCallback((id: string) => {
    setSchedule((s) => s ? { ...s, shifts: s.shifts?.filter((sh) => sh.id !== id) } : s)
  }, [setSchedule])

  const restoreShift = useCallback((shift: Shift) => {
    setSchedule((s) => s ? { ...s, shifts: [...(s.shifts ?? []), shift] } : s)
  }, [setSchedule])

  const appendShift = useCallback((shift: Shift) => {
    setSchedule((s) => s ? { ...s, shifts: [...(s.shifts ?? []), shift] } : s)
  }, [setSchedule])

  const replaceShift = useCallback((tempId: string, serverShift: Shift) => {
    setSchedule((s) => s ? { ...s, shifts: s.shifts?.map((sh) => sh.id === tempId ? serverShift : sh) } : s)
  }, [setSchedule])

  const handleShiftMove = useCallback(
    (shiftId: string, newDate: string, newEmployeeId: string) => {
      if (!schedule) return
      const prev = schedule.shifts?.find((s) => s.id === shiftId)
      patchShift(shiftId, { date: newDate, employeeId: newEmployeeId })
      fetch(`/api/orgs/${orgId}/schedules/${schedule.id}/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, employeeId: newEmployeeId }),
      }).then(async (r) => {
        if (r.ok) { toast.success("Shift moved"); return }
        const msg = await r.json().then((b) => b.error).catch(() => null)
        rollbackShift(shiftId, prev); toast.error(msg ?? "Failed to move shift")
      }).catch(() => { rollbackShift(shiftId, prev); toast.error("Failed to move shift") })
    },
    [schedule, orgId, patchShift, rollbackShift]
  )

  const handleShiftCreate = useCallback(
    async (data: {
      employeeId: string; date: string; startTime: string; endTime: string
      breakMinutes: number; jobRole: string; notes: string | null; colorTag: string | null
    }) => {
      // Lazily create the schedule if this week has no schedule yet.
      const activeSchedule = await ensureSchedule()
      const tempId = crypto.randomUUID()
      const optimistic: Shift = {
        id: tempId, scheduleId: activeSchedule.id, organizationId: orgId,
        ...data, cancelledAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      appendShift(optimistic)
      try {
        const r = await fetch(`/api/orgs/${orgId}/schedules/${activeSchedule.id}/shifts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        const res = (await r.json()) as { data?: Shift; error?: string }
        if (res.data) { replaceShift(tempId, res.data); toast.success("Shift added"); return true }
        deleteShift(tempId); toast.error(res.error ?? "Failed to add shift"); return false
      } catch {
        deleteShift(tempId); toast.error("Failed to add shift"); return false
      }
    },
    [ensureSchedule, orgId, appendShift, replaceShift, deleteShift]
  )

  const handleShiftUpdate = useCallback(
    (data: Partial<Shift>) => {
      if (!schedule || !data.id) return
      const prev = schedule.shifts?.find((s) => s.id === data.id)
      patchShift(data.id, data)
      fetch(`/api/orgs/${orgId}/schedules/${schedule.id}/shifts/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (r.ok) { toast.success("Shift updated"); return }
        const msg = await r.json().then((b) => b.error).catch(() => null)
        rollbackShift(data.id!, prev); toast.error(msg ?? "Failed to update shift")
      }).catch(() => { rollbackShift(data.id!, prev); toast.error("Failed to update shift") })
    },
    [schedule, orgId, patchShift, rollbackShift]
  )

  const handleShiftDelete = useCallback(
    (shiftId: string) => {
      if (!schedule) return
      const prev = schedule.shifts?.find((s) => s.id === shiftId)
      deleteShift(shiftId)
      fetch(`/api/orgs/${orgId}/schedules/${schedule.id}/shifts/${shiftId}`, { method: "DELETE" })
        .then((r) => {
          if (r.ok) toast.success("Shift deleted")
          else { if (prev) restoreShift(prev); toast.error("Failed to delete shift") }
        }).catch(() => { if (prev) restoreShift(prev); toast.error("Failed to delete shift") })
    },
    [schedule, orgId, deleteShift, restoreShift]
  )

  const handleShiftCancel = useCallback(
    (shiftId: string) => {
      if (!schedule) return
      const prev = schedule.shifts?.find((s) => s.id === shiftId)
      patchShift(shiftId, { cancelledAt: new Date().toISOString() })
      fetch(`/api/orgs/${orgId}/schedules/${schedule.id}/shifts/${shiftId}/cancel`, { method: "POST" })
        .then(async (r) => {
          if (r.ok) {
            const res = (await r.json()) as { data?: Shift }
            if (res.data) patchShift(shiftId, res.data)
            toast.success("Shift cancelled — the employee has been notified")
            return
          }
          const msg = await r.json().then((b) => b.error).catch(() => null)
          rollbackShift(shiftId, prev); toast.error(msg ?? "Failed to cancel shift")
        }).catch(() => { rollbackShift(shiftId, prev); toast.error("Failed to cancel shift") })
    },
    [schedule, orgId, patchShift, rollbackShift]
  )

  const handleMarkSick = useCallback(
    async (employeeId: string, date: string) => {
      const activeSchedule = await ensureSchedule()
      const tempId = crypto.randomUUID()
      const sickShift: Shift = {
        id: tempId, scheduleId: activeSchedule.id, organizationId: orgId,
        employeeId, date, startTime: "00:00", endTime: "00:00",
        breakMinutes: 0, jobRole: "Sick Day", notes: null, colorTag: "sick",
        cancelledAt: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      appendShift(sickShift)
      fetch(`/api/orgs/${orgId}/schedules/${activeSchedule.id}/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, date, startTime: "00:00", endTime: "00:00", breakMinutes: 0, jobRole: "Sick Day", colorTag: "sick" }),
      }).then((r) => r.json()).then((res: { data?: Shift; error?: string }) => {
        if (res.data) {
          replaceShift(tempId, res.data)
          const emp = employees.find((e) => e.id === employeeId)
          toast.success(`Sick day registered${emp ? ` for ${emp.name}` : ""}`)
        } else {
          deleteShift(tempId)
          toast.error(res.error ?? "Failed to register sick day")
        }
      }).catch(() => { deleteShift(tempId); toast.error("Failed to register sick day") })
    },
    [ensureSchedule, orgId, employees, appendShift, replaceShift, deleteShift]
  )

  return { handleShiftMove, handleShiftCreate, handleShiftUpdate, handleShiftDelete, handleShiftCancel, handleMarkSick }
}
