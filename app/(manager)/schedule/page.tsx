"use client"

import { useState, useCallback } from "react"
import { ChevronLeft, ChevronRight, LayoutGrid, AlignLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WeeklyScheduleGrid } from "@/components/manager/WeeklyScheduleGrid"
import { ShiftTimeline } from "@/components/manager/ShiftTimeline"
import { getOrgSettings } from "@/lib/orgSettings"
import { getMondayOfWeek, addDays, formatDayLabel } from "@/lib/dateUtils"
import { WeekPicker } from "@/components/manager/WeekPicker"
import { toast } from "sonner"
import type { Shift } from "@/types"
import { MOCK_JOB_ROLES } from "@/lib/mockData"
import { getEmployees } from "@/lib/employeeStore"
import { getSchedule, mutateSchedule } from "@/lib/scheduleStore"

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [weekStart, setWeekStart] = useState<string>(
    getMondayOfWeek(new Date())
  )
  const [schedule, setSchedule] = useState(() =>
    getSchedule(getMondayOfWeek(new Date()))
  )
  const [viewMode, setViewMode] = useState<"week" | "timeline">("week")
  const [selectedDay, setSelectedDay] = useState<string>(
    new Date().toISOString().split("T")[0]
  )

  // Write to the store AND update local state in one call
  const mutate = useCallback((updater: (prev: typeof schedule) => typeof schedule) => {
    setSchedule((prev) => {
      const next = updater(prev)
      mutateSchedule(prev.weekStart, () => next)
      return next
    })
  }, [])

  const loadWeek = (newWeekStart: string) => {
    setWeekStart(newWeekStart)
    setSchedule(getSchedule(newWeekStart))
  }

  const navigateWeek = (direction: -1 | 1) => {
    const newWeekStart = addDays(weekStart, direction * 7)
    loadWeek(newWeekStart)
    setSelectedDay(addDays(selectedDay, direction * 7))
  }

  const goToToday = () => {
    const today = new Date().toISOString().split("T")[0]
    loadWeek(getMondayOfWeek(new Date()))
    setSelectedDay(today)
  }

  const jumpToWeek = (newWeekStart: string) => {
    const currentOffset = Math.round(
      (new Date(selectedDay + "T12:00:00").getTime() - new Date(weekStart + "T12:00:00").getTime()) /
      86400000
    )
    loadWeek(newWeekStart)
    setSelectedDay(addDays(newWeekStart, Math.max(0, Math.min(6, currentOffset))))
  }

  const jumpToDay = (day: string) => {
    const newWeekStart = getMondayOfWeek(new Date(day + "T12:00:00"))
    setSelectedDay(day)
    if (newWeekStart !== weekStart) loadWeek(newWeekStart)
  }

  const navigateDay = (direction: -1 | 1) => {
    const newDay = addDays(selectedDay, direction)
    const newWeekStart = getMondayOfWeek(new Date(newDay + "T12:00:00"))
    setSelectedDay(newDay)
    if (newWeekStart !== weekStart) loadWeek(newWeekStart)
  }

  const handleShiftMove = useCallback(
    (shiftId: string, newDate: string, newEmployeeId: string) => {
      mutate((prev) => ({
        ...prev,
        shifts: prev.shifts?.map((s) =>
          s.id === shiftId ? { ...s, date: newDate, employeeId: newEmployeeId } : s
        ),
      }))
      toast.success("Shift moved")
    },
    [mutate]
  )

  const handleShiftCreate = useCallback(
    (data: {
      employeeId: string
      date: string
      startTime: string
      endTime: string
      breakMinutes: number
      jobRole: string
      notes: string | null
      colorTag: string | null
    }) => {
      mutate((prev) => ({
        ...prev,
        shifts: [
          ...(prev.shifts ?? []),
          {
            id: crypto.randomUUID(),
            scheduleId: prev.id,
            organizationId: "org-1",
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }))
      toast.success("Shift added")
    },
    [mutate]
  )

  const handleShiftUpdate = useCallback((data: Partial<Shift>) => {
    mutate((prev) => ({
      ...prev,
      shifts: prev.shifts?.map((s) => (s.id === data.id ? { ...s, ...data } : s)),
    }))
    toast.success("Shift updated")
  }, [mutate])

  const handleShiftDelete = useCallback((shiftId: string) => {
    mutate((prev) => ({
      ...prev,
      shifts: prev.shifts?.filter((s) => s.id !== shiftId),
    }))
    toast.success("Shift deleted")
  }, [mutate])

  const handleMarkSick = useCallback(
    (employeeId: string, date: string) => {
      mutate((prev) => ({
        ...prev,
        shifts: [
          ...(prev.shifts ?? []),
          {
            id: crypto.randomUUID(),
            scheduleId: prev.id,
            organizationId: "org-1",
            employeeId,
            date,
            startTime: "00:00",
            endTime: "00:00",
            breakMinutes: 0,
            jobRole: "Sick Day",
            notes: null,
            colorTag: "sick",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }))
      const employee = getEmployees().find((e) => e.id === employeeId)
      toast.success(`Sick day registered${employee ? ` for ${employee.name}` : ""}`)
    },
    [mutate]
  )

  const today = new Date().toISOString().split("T")[0]
  const isCurrentWeek = getMondayOfWeek(new Date()) === weekStart
  const todayHidden = viewMode === "timeline" ? selectedDay === today : isCurrentWeek

  // Derive timeline bounds from org settings
  const orgSettings = getOrgSettings()
  // JS getDay(): 0=Sun…6=Sat → convert to Mon=0…Sun=6
  const jsDay = new Date(selectedDay + "T12:00:00").getDay()
  const dayIdx = jsDay === 0 ? 6 : jsDay - 1
  const dayHours = orgSettings.hours[dayIdx]
  let timelineStartHour: number
  let timelineEndHour: number
  if (dayHours.isOpen) {
    const [openHour] = dayHours.openTime.split(":").map(Number)
    const [closeHour] = dayHours.closeTime.split(":").map(Number)
    timelineStartHour = Math.max(0, openHour - 2)
    timelineEndHour = Math.min(23, closeHour + 2)
  } else {
    const openDays = orgSettings.hours.filter((h) => h.isOpen)
    if (openDays.length > 0) {
      const minOpen = Math.min(...openDays.map((h) => parseInt(h.openTime.split(":")[0], 10)))
      const maxClose = Math.max(...openDays.map((h) => parseInt(h.closeTime.split(":")[0], 10)))
      timelineStartHour = Math.max(0, minOpen - 2)
      timelineEndHour = Math.min(23, maxClose + 2)
    } else {
      timelineStartHour = 6
      timelineEndHour = 23
    }
  }

  // Compute scheduled hours per employee for the current week
  const scheduledHoursMap = getEmployees().reduce<Record<string, number>>((acc, emp) => {
    const empShifts = (schedule.shifts ?? []).filter(
      (s) => s.employeeId === emp.id && s.colorTag !== "sick"
    )
    const totalHours = empShifts.reduce((sum, s) => {
      const [startH, startM] = s.startTime.split(":").map(Number)
      const [endH, endM] = s.endTime.split(":").map(Number)
      const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM) - s.breakMinutes
      return sum + Math.max(0, durationMinutes) / 60
    }, 0)
    acc[emp.id] = totalHours
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar — identical for both views */}
      <div className="flex items-center gap-2 px-4 md:px-6 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-gray-900 hidden sm:block shrink-0">
          Schedule
        </h1>

        {/* View toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
          <button
            onClick={() => setViewMode("week")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "week"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-500 hover:text-gray-700"
            }`}
          >
            <LayoutGrid className="size-3.5" />
            Week
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-l border-gray-200 transition-colors ${
              viewMode === "timeline"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-500 hover:text-gray-700"
            }`}
          >
            <AlignLeft className="size-3.5" />
            Timeline
          </button>
        </div>

        <div className="flex-1" />

        {/* Unified week nav */}
        <Button
          variant="outline"
          size="sm"
          onClick={goToToday}
          disabled={todayHidden}
          className={todayHidden ? "opacity-0 pointer-events-none" : ""}
        >
          Today
        </Button>

        {viewMode === "timeline" ? (
          <>
            <Button variant="outline" size="icon-sm" onClick={() => navigateDay(-1)} aria-label="Previous day">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-semibold text-gray-700 min-w-44 text-center hidden sm:block">
              {formatDayLabel(selectedDay)}
            </span>
            <Button variant="outline" size="icon-sm" onClick={() => navigateDay(1)} aria-label="Next day">
              <ChevronRight className="size-4" />
            </Button>
            <div className="w-px h-4 bg-gray-200 hidden sm:block" />
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
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto pb-16 md:pb-0">
        {getEmployees().length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center py-16">
              <p className="text-sm font-medium text-gray-500">No employees yet</p>
              <p className="text-xs text-gray-400 mt-1">Add employees first, then create a schedule.</p>
            </div>
          </div>
        ) : viewMode === "week" ? (
          <WeeklyScheduleGrid
            schedule={schedule}
            employees={getEmployees()}
            jobRoles={MOCK_JOB_ROLES}
            scheduledHoursMap={scheduledHoursMap}
            onShiftMove={handleShiftMove}
            onShiftCreate={handleShiftCreate}
            onShiftUpdate={handleShiftUpdate}
            onShiftDelete={handleShiftDelete}
            onMarkSick={handleMarkSick}
          />
        ) : (
          <ShiftTimeline
            date={selectedDay}
            employees={getEmployees()}
            shifts={schedule.shifts ?? []}
            jobRoles={MOCK_JOB_ROLES}
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
