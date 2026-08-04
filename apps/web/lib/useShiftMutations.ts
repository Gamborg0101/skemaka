import { useCallback } from "react"
import type { Dispatch, SetStateAction } from "react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import type { Schedule, Shift } from "@/types"

export function useShiftMutations(
  schedule: Schedule | null,
  setSchedule: Dispatch<SetStateAction<Schedule | null>>,
  orgId: string,
  employees: Array<{ id: string; name: string }>,
  ensureSchedule: () => Promise<Schedule>,
) {
  const t = useTranslations("manager.toasts")
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
        if (r.ok) { toast.success(t("shiftMoved")); return }
        const msg = await r.json().then((b) => b.error).catch(() => null)
        rollbackShift(shiftId, prev); toast.error(msg ?? t("shiftMoveFailed"))
      }).catch(() => { rollbackShift(shiftId, prev); toast.error(t("shiftMoveFailed")) })
    },
    [schedule, orgId, patchShift, rollbackShift, t]
  )

  const handleShiftCreate = useCallback(
    async (data: {
      employeeId: string; date: string; startTime: string; endTime: string
      breakMinutes: number; jobRole: string; notes: string | null; colorTag: string | null
      notifyNow?: boolean
    }) => {
      // Lazily create the schedule if this week has no schedule yet.
      const activeSchedule = await ensureSchedule()
      const tempId = crypto.randomUUID()
      const { notifyNow, ...shiftFields } = data
      const optimistic: Shift = {
        id: tempId, scheduleId: activeSchedule.id, organizationId: orgId,
        ...shiftFields,
        cancelledAt: null,
        // Draft placeholder unless the manager chose to send it right away.
        publishedAt: notifyNow ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      appendShift(optimistic)
      try {
        const r = await fetch(`/api/orgs/${orgId}/schedules/${activeSchedule.id}/shifts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        const res = (await r.json()) as { data?: Shift; error?: string }
        if (res.data) { replaceShift(tempId, res.data); toast.success(t("shiftAdded")); return true }
        deleteShift(tempId); toast.error(res.error ?? t("shiftAddFailed")); return false
      } catch {
        deleteShift(tempId); toast.error(t("shiftAddFailed")); return false
      }
    },
    [ensureSchedule, orgId, appendShift, replaceShift, deleteShift, t]
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
        if (r.ok) { toast.success(t("shiftUpdated")); return }
        const msg = await r.json().then((b) => b.error).catch(() => null)
        rollbackShift(data.id!, prev); toast.error(msg ?? t("shiftUpdateFailed"))
      }).catch(() => { rollbackShift(data.id!, prev); toast.error(t("shiftUpdateFailed")) })
    },
    [schedule, orgId, patchShift, rollbackShift, t]
  )

  const handleShiftDelete = useCallback(
    (shiftId: string) => {
      if (!schedule) return
      const prev = schedule.shifts?.find((s) => s.id === shiftId)
      deleteShift(shiftId)
      fetch(`/api/orgs/${orgId}/schedules/${schedule.id}/shifts/${shiftId}`, { method: "DELETE" })
        .then((r) => {
          if (r.ok) toast.success(t("shiftDeleted"))
          else { if (prev) restoreShift(prev); toast.error(t("shiftDeleteFailed")) }
        }).catch(() => { if (prev) restoreShift(prev); toast.error(t("shiftDeleteFailed")) })
    },
    [schedule, orgId, deleteShift, restoreShift, t]
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
            toast.success(t("shiftCancelled"))
            return
          }
          const msg = await r.json().then((b) => b.error).catch(() => null)
          rollbackShift(shiftId, prev); toast.error(msg ?? t("shiftCancelFailed"))
        }).catch(() => { rollbackShift(shiftId, prev); toast.error(t("shiftCancelFailed")) })
    },
    [schedule, orgId, patchShift, rollbackShift, t]
  )

  const handleMarkSick = useCallback(
    async (
      employeeId: string,
      date: string,
      details?: { startTime: string; endTime: string; reason: string },
    ) => {
      const activeSchedule = await ensureSchedule()
      const tempId = crypto.randomUUID()
      // Hours the person was expected to work (for the record); reason → notes.
      // Falls back to a bare 00:00 marker if no details were provided.
      const startTime = details?.startTime ?? "00:00"
      const endTime = details?.endTime ?? "00:00"
      const notes = details?.reason?.trim() ? details.reason.trim() : null
      const sickShift: Shift = {
        id: tempId, scheduleId: activeSchedule.id, organizationId: orgId,
        employeeId, date, startTime, endTime,
        breakMinutes: 0, jobRole: "Sick Day", notes, colorTag: "sick",
        cancelledAt: null,
        // Sick days are records, not plans — born published, never rolled out.
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      appendShift(sickShift)
      fetch(`/api/orgs/${orgId}/schedules/${activeSchedule.id}/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, date, startTime, endTime, breakMinutes: 0, jobRole: "Sick Day", notes, colorTag: "sick" }),
      }).then((r) => r.json()).then((res: { data?: Shift; error?: string }) => {
        if (res.data) {
          replaceShift(tempId, res.data)
          const emp = employees.find((e) => e.id === employeeId)
          toast.success(emp ? t("sickDayRegisteredFor", { name: emp.name }) : t("sickDayRegistered"))
        } else {
          deleteShift(tempId)
          toast.error(res.error ?? t("sickDayRegisterFailed"))
        }
      }).catch(() => { deleteShift(tempId); toast.error(t("sickDayRegisterFailed")) })
    },
    [ensureSchedule, orgId, employees, appendShift, replaceShift, deleteShift, t]
  )

  return { handleShiftMove, handleShiftCreate, handleShiftUpdate, handleShiftDelete, handleShiftCancel, handleMarkSick }
}
