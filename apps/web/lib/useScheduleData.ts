"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import type { Employee, Schedule, TimeOffRequest } from "@/types"
import { useShiftMutations } from "@/lib/useShiftMutations"

export function useScheduleData(orgId: string, weekStart: string) {
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [approvedTimeOff, setApprovedTimeOff] = useState<TimeOffRequest[]>([])

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/employees`)
      .then((r) => r.json())
      .then((data: { data?: Employee[] }) => { if (data.data) setEmployees(data.data) })
      .catch(() => toast.error("Failed to load employees"))
  }, [orgId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)

    fetch(`/api/orgs/${orgId}/schedules?weekStart=${weekStart}`)
      .then((r) => r.json())
      .then((data: { data: Schedule | null }) => {
        if (cancelled) return
        // Return null when no schedule exists — don't auto-create.
        // The schedule is created lazily when the user adds their first shift.
        setSchedule(data.data ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true)
          toast.error("Failed to load schedule")
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [weekStart, orgId])

  // Lazily creates the schedule for a week on first shift add. Returns the
  // schedule (existing or newly created) so callers can immediately use its id.
  const ensureSchedule = useCallback(async (): Promise<Schedule> => {
    if (schedule) return schedule
    const r = await fetch(`/api/orgs/${orgId}/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart }),
    })
    const data = await r.json() as { data: Schedule }
    const newSchedule = { ...data.data, shifts: [] }
    setSchedule(newSchedule)
    return newSchedule
  }, [schedule, orgId, weekStart])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/orgs/${orgId}/time-off?status=APPROVED&weekStart=${weekStart}`)
      .then((r) => r.json())
      .then((data: { data?: TimeOffRequest[] }) => { if (!cancelled && data.data) setApprovedTimeOff(data.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [weekStart, orgId])

  const handlePublish = async () => {
    if (!schedule) return
    setPublishing(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: true }),
      })
      const res = await r.json() as { data?: Schedule; error?: string }
      if (res.data) {
        setSchedule((s) => s ? { ...s, publishedAt: res.data!.publishedAt } : s)
        toast.success("Schedule published — employees notified by SMS")
      } else {
        toast.error(res.error ?? "Failed to publish schedule")
      }
    } catch {
      toast.error("Failed to publish schedule")
    } finally {
      setPublishing(false)
    }
  }

  const { handleShiftMove, handleShiftCreate, handleShiftUpdate, handleShiftDelete, handleMarkSick } =
    useShiftMutations(schedule, setSchedule, orgId, employees, ensureSchedule)

  return {
    schedule,
    loading,
    loadError,
    employees,
    approvedTimeOff,
    publishing,
    handlePublish,
    handleShiftMove,
    handleShiftCreate,
    handleShiftUpdate,
    handleShiftDelete,
    handleMarkSick,
  }
}
