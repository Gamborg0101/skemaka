"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { ChevronLeft, ChevronRight, LayoutGrid, AlignLeft, Users, UserPlus } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { WeeklyScheduleGrid } from "@/components/manager/WeeklyScheduleGrid"
import { ShiftTimeline } from "@/components/manager/ShiftTimeline"
import { getOrgSettings } from "@/lib/orgSettings"
import { getMondayOfWeek, addDays, formatDayLabel } from "@/lib/dateUtils"
import { WeekPicker } from "@/components/manager/WeekPicker"
import { toast } from "sonner"
import type { Shift, Employee, Schedule, TimeOffRequest } from "@/types"
import { useOrg } from "@/lib/orgContext"

export default function SchedulePage() {
  const { orgId, jobRoles, shiftTemplates } = useOrg()

  const [weekStart, setWeekStart] = useState<string>(getMondayOfWeek(new Date()))
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [approvedTimeOff, setApprovedTimeOff] = useState<TimeOffRequest[]>([])
  const [viewMode, setViewMode] = useState<"week" | "timeline">(() => getOrgSettings().defaultScheduleView)
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split("T")[0])
  const [dayCount, setDayCount] = useState<1 | 3 | 5 | 7>(1)

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/employees`)
      .then((r) => r.json())
      .then((data: { data?: Employee[] }) => { if (data.data) setEmployees(data.data) })
      .catch(() => toast.error("Failed to load employees"))
  }, [orgId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        const r = await fetch(`/api/orgs/${orgId}/schedules?weekStart=${weekStart}`)
        const data = await r.json() as { data: Schedule | null }
        if (cancelled) return

        if (data.data) {
          setSchedule(data.data)
        } else {
          const cr = await fetch(`/api/orgs/${orgId}/schedules`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ weekStart }),
          })
          const cdata = await cr.json() as { data: Schedule }
          if (!cancelled) setSchedule({ ...cdata.data, shifts: [] })
        }
      } catch {
        if (!cancelled) toast.error("Failed to load schedule")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [weekStart, orgId])

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

  const navigateWeek = (direction: -1 | 1) => {
    setWeekStart((ws) => addDays(ws, direction * 7))
    setSelectedDay((d) => addDays(d, direction * 7))
  }

  const goToToday = () => {
    setWeekStart(getMondayOfWeek(new Date()))
    setSelectedDay(new Date().toISOString().split("T")[0])
  }

  const jumpToWeek = (newWeekStart: string) => {
    const offset = Math.round(
      (new Date(selectedDay + "T12:00:00").getTime() - new Date(weekStart + "T12:00:00").getTime()) / 86400000
    )
    setWeekStart(newWeekStart)
    setSelectedDay(addDays(newWeekStart, Math.max(0, Math.min(6, offset))))
  }

  const jumpToDay = (day: string) => {
    const newWeekStart = getMondayOfWeek(new Date(day + "T12:00:00"))
    setSelectedDay(day)
    if (newWeekStart !== weekStart) setWeekStart(newWeekStart)
  }

  const navigateDay = (direction: -1 | 1) => {
    const newDay = addDays(selectedDay, direction)
    const newWeekStart = getMondayOfWeek(new Date(newDay + "T12:00:00"))
    setSelectedDay(newDay)
    if (newWeekStart !== weekStart) setWeekStart(newWeekStart)
  }

  const handleShiftMove = useCallback(
    (shiftId: string, newDate: string, newEmployeeId: string) => {
      if (!schedule) return
      const prev = schedule.shifts?.find((s) => s.id === shiftId)
      setSchedule((s) => s ? {
        ...s,
        shifts: s.shifts?.map((sh) => sh.id === shiftId ? { ...sh, date: newDate, employeeId: newEmployeeId } : sh),
      } : s)

      fetch(`/api/orgs/${orgId}/schedules/${schedule.id}/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, employeeId: newEmployeeId }),
      }).then((r) => {
        if (r.ok) {
          toast.success("Shift moved")
        } else {
          setSchedule((s) => s ? { ...s, shifts: s.shifts?.map((sh) => sh.id === shiftId && prev ? { ...sh, ...prev } : sh) } : s)
          toast.error("Failed to move shift")
        }
      }).catch(() => {
        setSchedule((s) => s ? { ...s, shifts: s.shifts?.map((sh) => sh.id === shiftId && prev ? { ...sh, ...prev } : sh) } : s)
        toast.error("Failed to move shift")
      })
    },
    [schedule, orgId]
  )

  const handleShiftCreate = useCallback(
    (data: {
      employeeId: string; date: string; startTime: string; endTime: string
      breakMinutes: number; jobRole: string; notes: string | null; colorTag: string | null
    }) => {
      if (!schedule) return
      const tempId = crypto.randomUUID()
      const optimistic: Shift = {
        id: tempId, scheduleId: schedule.id, organizationId: orgId,
        ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      setSchedule((s) => s ? { ...s, shifts: [...(s.shifts ?? []), optimistic] } : s)

      fetch(`/api/orgs/${orgId}/schedules/${schedule.id}/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()).then((res: { data?: Shift }) => {
        if (res.data) {
          setSchedule((s) => s ? { ...s, shifts: s.shifts?.map((sh) => sh.id === tempId ? res.data! : sh) } : s)
          toast.success("Shift added")
        } else {
          setSchedule((s) => s ? { ...s, shifts: s.shifts?.filter((sh) => sh.id !== tempId) } : s)
          toast.error("Failed to add shift")
        }
      }).catch(() => {
        setSchedule((s) => s ? { ...s, shifts: s.shifts?.filter((sh) => sh.id !== tempId) } : s)
        toast.error("Failed to add shift")
      })
    },
    [schedule, orgId]
  )

  const handleShiftUpdate = useCallback(
    (data: Partial<Shift>) => {
      if (!schedule || !data.id) return
      const prev = schedule.shifts?.find((s) => s.id === data.id)
      setSchedule((s) => s ? { ...s, shifts: s.shifts?.map((sh) => sh.id === data.id ? { ...sh, ...data } : sh) } : s)

      fetch(`/api/orgs/${orgId}/schedules/${schedule.id}/shifts/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (r.ok) {
          toast.success("Shift updated")
        } else {
          setSchedule((s) => s ? { ...s, shifts: s.shifts?.map((sh) => sh.id === data.id && prev ? { ...sh, ...prev } : sh) } : s)
          toast.error("Failed to update shift")
        }
      }).catch(() => {
        setSchedule((s) => s ? { ...s, shifts: s.shifts?.map((sh) => sh.id === data.id && prev ? { ...sh, ...prev } : sh) } : s)
        toast.error("Failed to update shift")
      })
    },
    [schedule, orgId]
  )

  const handleShiftDelete = useCallback(
    (shiftId: string) => {
      if (!schedule) return
      const prev = schedule.shifts?.find((s) => s.id === shiftId)
      setSchedule((s) => s ? { ...s, shifts: s.shifts?.filter((sh) => sh.id !== shiftId) } : s)

      fetch(`/api/orgs/${orgId}/schedules/${schedule.id}/shifts/${shiftId}`, { method: "DELETE" })
        .then((r) => {
          if (r.ok) {
            toast.success("Shift deleted")
          } else {
            setSchedule((s) => s ? { ...s, shifts: prev ? [...(s.shifts ?? []), prev] : s.shifts } : s)
            toast.error("Failed to delete shift")
          }
        }).catch(() => {
          setSchedule((s) => s ? { ...s, shifts: prev ? [...(s.shifts ?? []), prev] : s.shifts } : s)
          toast.error("Failed to delete shift")
        })
    },
    [schedule, orgId]
  )

  const handleMarkSick = useCallback(
    (employeeId: string, date: string) => {
      if (!schedule) return
      const tempId = crypto.randomUUID()
      const sickShift: Shift = {
        id: tempId, scheduleId: schedule.id, organizationId: orgId,
        employeeId, date, startTime: "00:00", endTime: "00:00",
        breakMinutes: 0, jobRole: "Sick Day", notes: null, colorTag: "sick",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      setSchedule((s) => s ? { ...s, shifts: [...(s.shifts ?? []), sickShift] } : s)

      fetch(`/api/orgs/${orgId}/schedules/${schedule.id}/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, date, startTime: "00:00", endTime: "00:00", breakMinutes: 0, jobRole: "Sick Day", colorTag: "sick" }),
      }).then((r) => r.json()).then((res: { data?: Shift }) => {
        if (res.data) {
          setSchedule((s) => s ? { ...s, shifts: s.shifts?.map((sh) => sh.id === tempId ? res.data! : sh) } : s)
          const emp = employees.find((e) => e.id === employeeId)
          toast.success(`Sick day registered${emp ? ` for ${emp.name}` : ""}`)
        } else {
          setSchedule((s) => s ? { ...s, shifts: s.shifts?.filter((sh) => sh.id !== tempId) } : s)
          toast.error("Failed to register sick day")
        }
      }).catch(() => {
        setSchedule((s) => s ? { ...s, shifts: s.shifts?.filter((sh) => sh.id !== tempId) } : s)
        toast.error("Failed to register sick day")
      })
    },
    [schedule, orgId, employees]
  )

  const today = new Date().toISOString().split("T")[0]
  const isCurrentWeek = getMondayOfWeek(new Date()) === weekStart

  const timelineDates = useMemo(() => {
    const base = dayCount === 1 ? selectedDay : weekStart
    return Array.from({ length: dayCount }, (_, i) => addDays(base, i))
  }, [dayCount, selectedDay, weekStart])

  const todayHidden = viewMode === "week"
    ? isCurrentWeek
    : dayCount === 1 ? selectedDay === today : isCurrentWeek

  const orgSettings = getOrgSettings()
  const { timelineStartHour, timelineEndHour } = useMemo(() => {
    let minStart = 24, maxEnd = 0
    for (const d of timelineDates) {
      const jsDay = new Date(d + "T12:00:00").getDay()
      const idx = jsDay === 0 ? 6 : jsDay - 1
      const dh = orgSettings.hours[idx]
      if (dh.isOpen) {
        minStart = Math.min(minStart, parseInt(dh.openTime.split(":")[0], 10))
        maxEnd = Math.max(maxEnd, parseInt(dh.closeTime.split(":")[0], 10))
      }
    }
    if (minStart >= 24) {
      const openDays = orgSettings.hours.filter((h) => h.isOpen)
      if (openDays.length > 0) {
        minStart = Math.min(...openDays.map((h) => parseInt(h.openTime.split(":")[0], 10)))
        maxEnd = Math.max(...openDays.map((h) => parseInt(h.closeTime.split(":")[0], 10)))
      } else {
        return { timelineStartHour: 6, timelineEndHour: 23 }
      }
    }
    return { timelineStartHour: Math.max(0, minStart - 2), timelineEndHour: Math.min(23, maxEnd + 2) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineDates])

  const scheduledHoursMap = useMemo(() =>
    employees.reduce<Record<string, number>>((acc, emp) => {
      const empShifts = (schedule?.shifts ?? []).filter((s) => s.employeeId === emp.id && s.colorTag !== "sick")
      acc[emp.id] = empShifts.reduce((sum, s) => {
        const [sh, sm] = s.startTime.split(":").map(Number)
        const [eh, em] = s.endTime.split(":").map(Number)
        return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm) - s.breakMinutes) / 60
      }, 0)
      return acc
    }, {}),
  [employees, schedule?.shifts])

  // Shared header elements
  const viewToggle = (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
      <button
        onClick={() => setViewMode("week")}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
          viewMode === "week" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:text-gray-700"
        }`}
      >
        <LayoutGrid className="size-3.5" />
        Week
      </button>
      <button
        onClick={() => setViewMode("timeline")}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-l border-gray-200 transition-colors ${
          viewMode === "timeline" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:text-gray-700"
        }`}
      >
        <AlignLeft className="size-3.5" />
        Timeline
      </button>
    </div>
  )

  const dayCountSelector = viewMode === "timeline" ? (
    <div className="flex rounded-md border border-gray-200 overflow-hidden shrink-0">
      {([1, 3, 5, 7] as const).map((n, i) => (
        <button
          key={n}
          onClick={() => setDayCount(n)}
          className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${i > 0 ? "border-l border-gray-200" : ""} ${
            dayCount === n ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:text-gray-700"
          }`}
        >
          {n}d
        </button>
      ))}
    </div>
  ) : null

  const navControls = viewMode === "timeline" ? (
    dayCount === 1 ? (
      <>
        <Button variant="outline" size="icon-sm" onClick={() => navigateDay(-1)} aria-label="Previous day">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold text-gray-700 min-w-44 text-center hidden md:block">
          {formatDayLabel(selectedDay)}
        </span>
        <Button variant="outline" size="icon-sm" onClick={() => navigateDay(1)} aria-label="Next day">
          <ChevronRight className="size-4" />
        </Button>
        <WeekPicker weekStart={weekStart} onChange={jumpToDay} dayMode selectedDay={selectedDay} />
      </>
    ) : (
      <>
        <Button variant="outline" size="icon-sm" onClick={() => navigateWeek(-1)} aria-label="Previous week">
          <ChevronLeft className="size-4" />
        </Button>
        <WeekPicker weekStart={weekStart} onChange={jumpToWeek} />
        <Button variant="outline" size="icon-sm" onClick={() => navigateWeek(1)} aria-label="Next week">
          <ChevronRight className="size-4" />
        </Button>
      </>
    )
  ) : (
    <>
      <Button variant="outline" size="icon-sm" onClick={() => navigateWeek(-1)} aria-label="Previous week">
        <ChevronLeft className="size-4" />
      </Button>
      <WeekPicker weekStart={weekStart} onChange={jumpToWeek} />
      <Button variant="outline" size="icon-sm" onClick={() => navigateWeek(1)} aria-label="Next week">
        <ChevronRight className="size-4" />
      </Button>
    </>
  )

  const publishBtn = (
    <Button
      size="sm"
      onClick={handlePublish}
      disabled={publishing || !schedule || !!schedule.publishedAt}
      className={schedule?.publishedAt
        ? "bg-green-50 border border-green-200 text-green-700 hover:bg-green-50 shrink-0"
        : "bg-blue-600 hover:bg-blue-700 text-white shrink-0"}
    >
      {schedule?.publishedAt ? "Published ✓" : publishing ? "Publishing…" : "Publish"}
    </Button>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Desktop header — single row (md+) */}
      <div className="hidden md:flex items-center gap-2 px-6 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-gray-900 shrink-0">Schedule</h1>
        {viewToggle}
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={goToToday}
          disabled={todayHidden}
          className={todayHidden ? "opacity-0 pointer-events-none" : ""}
        >
          Today
        </Button>
        {dayCountSelector}
        {navControls}
        <div className="w-px h-4 bg-gray-200 shrink-0" />
        {publishBtn}
      </div>

      {/* Mobile header — two rows (<md) */}
      <div className="md:hidden border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-4 py-2">
          {viewToggle}
          <div className="flex-1" />
          {publishBtn}
        </div>
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-gray-100">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            disabled={todayHidden}
            className={todayHidden ? "invisible" : ""}
          >
            Today
          </Button>
          {dayCountSelector}
          <div className="flex-1 flex items-center justify-end gap-1">
            {navControls}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto pb-16 md:pb-0">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="size-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          </div>
        ) : employees.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4">
            <div className="text-center max-w-xs">
              <div className="size-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <Users className="size-8 text-blue-400" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">No employees yet</h2>
              <p className="text-sm text-gray-500 mb-6">
                Add your first employee to start building a schedule.
              </p>
              <Link href="/employees">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <UserPlus className="size-4" />
                  Add your first employee
                </Button>
              </Link>
            </div>
          </div>
        ) : viewMode === "week" ? (
          <WeeklyScheduleGrid
            schedule={schedule!}
            employees={employees}
            jobRoles={jobRoles}
            shiftTemplates={shiftTemplates}
            scheduledHoursMap={scheduledHoursMap}
            approvedTimeOff={approvedTimeOff}
            onShiftMove={handleShiftMove}
            onShiftCreate={handleShiftCreate}
            onShiftUpdate={handleShiftUpdate}
            onShiftDelete={handleShiftDelete}
            onMarkSick={handleMarkSick}
          />
        ) : (
          <ShiftTimeline
            dates={timelineDates}
            employees={employees}
            shifts={schedule?.shifts ?? []}
            jobRoles={jobRoles}
            shiftTemplates={shiftTemplates}
            scheduledHoursMap={scheduledHoursMap}
            startHour={timelineStartHour}
            endHour={timelineEndHour}
            onShiftCreate={handleShiftCreate}
            onShiftUpdate={handleShiftUpdate}
            onShiftDelete={handleShiftDelete}
          />
        )}
      </div>
    </div>
  )
}
