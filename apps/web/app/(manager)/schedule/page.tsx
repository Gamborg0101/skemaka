"use client"

import { useState, useMemo, useEffect } from "react"
import { ChevronLeft, ChevronRight, LayoutGrid, AlignLeft, Users, UserPlus, X } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { WeeklyScheduleGrid } from "@/components/manager/WeeklyScheduleGrid"
import { ShiftTimeline } from "@/components/manager/ShiftTimeline"
import { getOrgSettings } from "@/lib/orgSettings"
import { getMondayOfWeek, addDays, formatDayLabel } from "@/lib/dateUtils"
import { WeekPicker } from "@/components/manager/WeekPicker"
import { useOrg } from "@/lib/orgContext"
import { useScheduleData } from "@/lib/useScheduleData"
import { Skeleton } from "@/components/ui/skeleton"

export default function SchedulePage() {
  const { orgId, jobRoles, shiftTemplates } = useOrg()

  const [weekStart, setWeekStart] = useState<string>(getMondayOfWeek(new Date()))
  const [viewMode, setViewMode] = useState<"week" | "timeline">(() => getOrgSettings().defaultScheduleView)
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split("T")[0])
  const [dayCount, setDayCount] = useState<1 | 3 | 5 | 7>(1)
  const [hintDismissed, setHintDismissed] = useState(false)

  const {
    schedule, loading, employees, approvedTimeOff, publishing,
    handlePublish, handleShiftMove, handleShiftCreate, handleShiftUpdate, handleShiftDelete, handleMarkSick,
  } = useScheduleData(orgId, weekStart)

  const navigateWeek = (direction: -1 | 1) => {
    setWeekStart((ws) => addDays(ws, direction * 7))
    setSelectedDay((d) => addDays(d, direction * 7))
  }

  const goToToday = () => {
    setWeekStart(getMondayOfWeek(new Date()))
    setSelectedDay(new Date().toISOString().split("T")[0])
  }

  const jumpToWeek = (newWeekStart: string) => {
    setWeekStart(newWeekStart)
    setSelectedDay(newWeekStart)
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

  const today = new Date().toISOString().split("T")[0]
  const isCurrentWeek = getMondayOfWeek(new Date()) === weekStart

  const timelineDates = useMemo(() => {
    const weekSunday = addDays(weekStart, 6)
    return Array.from({ length: dayCount }, (_, i) => {
      const d = addDays(selectedDay, i)
      return d <= weekSunday ? d : null
    }).filter(Boolean) as string[]
  }, [dayCount, selectedDay, weekStart])

  const todayHidden = viewMode === "week"
    ? isCurrentWeek
    : timelineDates.includes(today)

  const { timelineStartHour, timelineEndHour } = useMemo(() => {
    const { hours } = getOrgSettings()
    let minStart = 24, maxEnd = 0
    for (const d of timelineDates) {
      const jsDay = new Date(d + "T12:00:00").getDay()
      const idx = jsDay === 0 ? 6 : jsDay - 1
      const dh = hours[idx]
      if (dh.isOpen) {
        minStart = Math.min(minStart, parseInt(dh.openTime.split(":")[0], 10))
        maxEnd = Math.max(maxEnd, parseInt(dh.closeTime.split(":")[0], 10))
      }
    }
    if (minStart >= 24) {
      const openDays = hours.filter((h) => h.isOpen)
      if (openDays.length > 0) {
        minStart = Math.min(...openDays.map((h) => parseInt(h.openTime.split(":")[0], 10)))
        maxEnd = Math.max(...openDays.map((h) => parseInt(h.closeTime.split(":")[0], 10)))
      } else {
        return { timelineStartHour: 6, timelineEndHour: 23 }
      }
    }
    return { timelineStartHour: Math.max(0, minStart - 2), timelineEndHour: Math.min(23, maxEnd + 2) }
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

  // Auto-select 1d on mobile when in timeline mode
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const handle = (e: MediaQueryListEvent) => {
      if (e.matches && viewMode === "timeline") setDayCount(1)
    }
    if (mq.matches && viewMode === "timeline") setDayCount(1)
    mq.addEventListener("change", handle)
    return () => mq.removeEventListener("change", handle)
  }, [viewMode])

  // Date range label for multi-day timeline nav
  const timelineRangeLabel = (() => {
    if (timelineDates.length === 0) return ""
    const fmt = (iso: string) => {
      const d = new Date(iso + "T12:00:00")
      return [
        d.toLocaleDateString("en-GB", { weekday: "short" }),
        d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      ].join(" ")
    }
    const first = timelineDates[0]
    const last = timelineDates[timelineDates.length - 1]
    return first === last ? fmt(first) : `${fmt(first)} – ${fmt(last)}`
  })()

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
    <div className="hidden md:flex rounded-md border border-gray-200 overflow-hidden shrink-0">
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
        <span className="text-sm font-semibold text-gray-700 text-center md:min-w-44">
          {formatDayLabel(selectedDay)}
        </span>
        <Button variant="outline" size="icon-sm" onClick={() => navigateDay(1)} aria-label="Next day">
          <ChevronRight className="size-4" />
        </Button>
        <WeekPicker weekStart={weekStart} onChange={jumpToDay} dayMode selectedDay={selectedDay} />
      </>
    ) : (
      <>
        <Button variant="outline" size="icon-sm" onClick={() => navigateDay(-1)} aria-label="Previous">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold text-gray-700 text-center hidden md:block md:min-w-44">
          {timelineRangeLabel}
        </span>
        <Button variant="outline" size="icon-sm" onClick={() => navigateDay(1)} aria-label="Next">
          <ChevronRight className="size-4" />
        </Button>
        <WeekPicker weekStart={weekStart} onChange={jumpToWeek} />
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
      <div className="hidden md:flex items-center gap-2 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50 shrink-0">Schedule</h1>
        {viewToggle}
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={goToToday}
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
      <div className="md:hidden border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2 px-4 py-2">
          {viewToggle}
          <div className="flex-1" />
          {publishBtn}
        </div>
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-gray-100 dark:border-gray-800">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
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
        {!loading && !hintDismissed && employees.length > 0 && (schedule?.shifts ?? []).length === 0 && (
          <div className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-blue-100 dark:border-gray-700 bg-blue-50 dark:bg-gray-800/60 px-4 py-3">
            <span className="text-sm text-blue-800 dark:text-gray-300 flex-1">
              <span className="font-semibold">Your schedule is ready.</span>{" "}
              Click any empty cell to add your first shift.
            </span>
            <button
              onClick={() => setHintDismissed(true)}
              aria-label="Dismiss"
              className="shrink-0 text-blue-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        {loading ? (
          <div className="p-4 space-y-0">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
              <div className="grid grid-cols-[160px_repeat(7,1fr)] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="px-4 py-3"><Skeleton className="h-4 w-20" /></div>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="px-2 py-3 text-center border-l border-gray-200 dark:border-gray-700">
                    <Skeleton className="h-3 w-8 mx-auto mb-1" />
                    <Skeleton className="h-4 w-6 mx-auto" />
                  </div>
                ))}
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`grid grid-cols-[160px_repeat(7,1fr)] border-b border-gray-100 dark:border-gray-800 ${i % 2 === 1 ? "bg-gray-50/50 dark:bg-gray-800/40" : "bg-white dark:bg-gray-900"}`}>
                  <div className="px-4 py-3 flex items-center gap-2.5">
                    <Skeleton className="size-8 rounded-full shrink-0" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <div key={j} className="border-l border-gray-100 dark:border-gray-800 p-2">
                      {j % 3 === 0 && i % 2 === 0 ? (
                        <Skeleton className="h-12 w-full rounded-lg" />
                      ) : null}
                    </div>
                  ))}
                </div>
              ))}
            </div>
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
            publishedAt={schedule?.publishedAt ?? null}
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
            publishedAt={schedule?.publishedAt ?? null}
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
