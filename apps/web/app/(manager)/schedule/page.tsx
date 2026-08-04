"use client"

import { useState, useMemo, useEffect } from "react"
import { useLocale, useTranslations } from "next-intl"
import { LOCALE_TAGS, type Locale } from "@skemaka/i18n"
import { ChevronLeft, ChevronRight, LayoutGrid, AlignLeft, Users, UserPlus, X, Sparkles, Megaphone } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { WeeklyScheduleGrid } from "@/components/manager/WeeklyScheduleGrid"
import { ShiftTimeline } from "@/components/manager/ShiftTimeline"
import { CoverRequestsPanel, type CoverFocus } from "@/components/manager/CoverRequestsPanel"
import { ShiftOffersPanel } from "@/components/manager/ShiftOffersPanel"
import { OfferShiftDialog } from "@/components/manager/OfferShiftDialog"
import { getOrgSettings } from "@/lib/orgSettings"
import { getMondayOfWeek, addDays, todayISO } from "@/lib/dateUtils"
import { WeekPicker } from "@/components/manager/WeekPicker"
import { RollOutDialog } from "@/components/manager/RollOutDialog"
import { useOrg } from "@/lib/orgContext"
import { useScheduleData } from "@/lib/useScheduleData"
import { Skeleton } from "@/components/ui/skeleton"
import type { Schedule } from "@/types"

export default function SchedulePage() {
  const t = useTranslations("manager.schedule")
  const localeTag = LOCALE_TAGS[useLocale() as Locale]
  const { orgId, jobRoles, shiftTemplates } = useOrg()

  const [weekStart, setWeekStart] = useState<string>(getMondayOfWeek(new Date()))
  const [viewMode, setViewMode] = useState<"week" | "timeline">(() => getOrgSettings().defaultScheduleView)
  const [selectedDay, setSelectedDay] = useState<string>(todayISO())
  const [dayCount, setDayCount] = useState<1 | 3 | 5 | 7>(1)
  const [hintDismissed, setHintDismissed] = useState(false)
  const [rollOutOpen, setRollOutOpen] = useState(false)
  // The cover request the manager is reviewing — highlighted on the grid.
  const [coverFocus, setCoverFocus] = useState<CoverFocus | null>(null)
  // Manager-initiated shift offers: dialog open + a token bumped to reload the panel.
  const [offerDialogOpen, setOfferDialogOpen] = useState(false)
  const [offersRefresh, setOffersRefresh] = useState(0)

  const focusCover = (f: CoverFocus | null) => {
    setCoverFocus(f)
    if (f) {
      // Bring the shift's week into view + prefer the week grid so both the
      // "giving up" and "would cover" cells are visible side by side.
      const ws = getMondayOfWeek(new Date(f.date + "T12:00:00"))
      if (ws !== weekStart) setWeekStart(ws)
      setViewMode("week")
    }
  }

  const {
    schedule, loading, employees, approvedTimeOff, getConflict,
    reloadSchedule, handleShiftMove, handleShiftCreate, handleShiftUpdate, handleShiftDelete, handleShiftCancel, handleMarkSick,
  } = useScheduleData(orgId, weekStart)

  // A schedule is created lazily (on first shift add), so it can be null even
  // after loading finishes — e.g. a brand-new org with employees but no shifts.
  // Render the (empty) week grid against this placeholder instead of crashing.
  const placeholderSchedule = useMemo<Schedule>(() => ({
    id: "",
    organizationId: orgId,
    weekStart,
    isDuplicate: false,
    sourceScheduleId: null,
    createdAt: "",
    updatedAt: "",
    shifts: [],
  }), [orgId, weekStart])

  const navigateWeek = (direction: -1 | 1) => {
    setWeekStart((ws) => addDays(ws, direction * 7))
    setSelectedDay((d) => addDays(d, direction * 7))
  }

  const goToToday = () => {
    setWeekStart(getMondayOfWeek(new Date()))
    setSelectedDay(todayISO())
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

  const today = todayISO()
  const isCurrentWeek = getMondayOfWeek(new Date()) === weekStart

  const timelineDates = useMemo(() => {
    const weekSunday = addDays(weekStart, 6)
    // The window starts at selectedDay when it fits, but slides BACK so the
    // requested number of days always shows — pressing 7d mid-week must show
    // the whole week (Mon–Sun), not trim at Sunday and look like a dead
    // button. The start is clamped to the current week so it never leaves it.
    let start = selectedDay
    if (start < weekStart) start = weekStart
    if (start > weekSunday) start = weekSunday
    const latestStart = addDays(weekSunday, -(dayCount - 1))
    if (start > latestStart) start = latestStart < weekStart ? weekStart : latestStart
    return Array.from({ length: dayCount }, (_, i) => addDays(start, i)).filter(
      (d) => d <= weekSunday,
    )
  }, [dayCount, selectedDay, weekStart])

  const todayHidden = viewMode === "week"
    ? isCurrentWeek
    : timelineDates.includes(today)

  const buffer = getOrgSettings().timelineBufferHours
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
    return { timelineStartHour: Math.max(0, minStart - buffer), timelineEndHour: Math.min(23, maxEnd + buffer) }
  }, [timelineDates, buffer])

  const scheduledHoursMap = useMemo(() =>
    employees.reduce<Record<string, number>>((acc, emp) => {
      const empShifts = (schedule?.shifts ?? []).filter((s) => s.employeeId === emp.id && s.colorTag !== "sick" && !s.cancelledAt)
      acc[emp.id] = empShifts.reduce((sum, s) => {
        const [sh, sm] = s.startTime.split(":").map(Number)
        const [eh, em] = s.endTime.split(":").map(Number)
        return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm) - s.breakMinutes) / 60
      }, 0)
      return acc
    }, {}),
  [employees, schedule?.shifts])

  // Auto-select 1d on mobile when in timeline mode.
  // The `handle` callback (async) is fine; the initial synchronous check is
  // moved into a separate event-listener setup with no immediate setState.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const handle = (e: MediaQueryListEvent) => {
      if (e.matches && viewMode === "timeline") setDayCount(1)
    }
    mq.addEventListener("change", handle)
    return () => mq.removeEventListener("change", handle)
  }, [viewMode])

  // Clamp dayCount to 1 on mobile during render, not in an effect.
  // This is the "adjust state during render" pattern recommended by React docs.
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches && viewMode === "timeline" && dayCount !== 1) {
    setDayCount(1)
  }

  // Date range label for the timeline nav. Single day keeps the weekday
  // ("Thu 16 Jul"); ranges drop it ("16 Jul – 19 Jul") — the long two-weekday
  // form overflowed the header on narrower windows and pushed the roll-out
  // button out of view.
  const timelineRangeLabel = (() => {
    if (timelineDates.length === 0) return ""
    const day = (iso: string) =>
      new Date(iso + "T12:00:00").toLocaleDateString(localeTag, { day: "numeric", month: "short" })
    const first = timelineDates[0]
    const last = timelineDates[timelineDates.length - 1]
    if (first === last) {
      const weekday = new Date(first + "T12:00:00").toLocaleDateString(localeTag, { weekday: "short" })
      return `${weekday} ${day(first)}`
    }
    return `${day(first)} – ${day(last)}`
  })()

  // Shared header elements
  // Segmented control: dark-blue track, white "thumb" on the selected option so
  // it's unmistakable which view is active.
  const segItem = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
      active
        ? "bg-white text-blue-700 shadow-sm"
        : "text-blue-100 hover:bg-white/10 hover:text-white"
    }`

  const viewToggle = (
    <div className="flex items-center gap-0.5 rounded-lg bg-blue-900 p-0.5 shrink-0">
      <button onClick={() => setViewMode("week")} className={segItem(viewMode === "week")}>
        <LayoutGrid className="size-3.5" />
        {t("week")}
      </button>
      <button onClick={() => setViewMode("timeline")} className={segItem(viewMode === "timeline")}>
        <AlignLeft className="size-3.5" />
        {t("timeline")}
      </button>
    </div>
  )

  const dayCountSelector = viewMode === "timeline" ? (
    <div className="hidden md:flex items-center gap-0.5 rounded-lg bg-blue-900 p-0.5 shrink-0">
      {([1, 3, 5, 7] as const).map((n) => (
        <button
          key={n}
          onClick={() => setDayCount(n)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            dayCount === n
              ? "bg-white text-blue-700 shadow-sm"
              : "text-blue-100 hover:bg-white/10 hover:text-white"
          }`}
        >
          {t("days", { n })}
        </button>
      ))}
    </div>
  ) : null

  const navControls = viewMode === "timeline" ? (
    dayCount === 1 ? (
      <>
        <Button variant="outline" size="icon-sm" onClick={() => navigateDay(-1)} aria-label={t("prevDay")}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 text-center whitespace-nowrap md:min-w-28">
          {timelineRangeLabel}
        </span>
        <Button variant="outline" size="icon-sm" onClick={() => navigateDay(1)} aria-label={t("nextDay")}>
          <ChevronRight className="size-4" />
        </Button>
        <WeekPicker weekStart={weekStart} onChange={jumpToDay} dayMode selectedDay={selectedDay} />
      </>
    ) : (
      <>
        <Button variant="outline" size="icon-sm" onClick={() => navigateDay(-1)} aria-label={t("prev")}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 text-center whitespace-nowrap hidden md:block md:min-w-28">
          {timelineRangeLabel}
        </span>
        <Button variant="outline" size="icon-sm" onClick={() => navigateDay(1)} aria-label={t("next")}>
          <ChevronRight className="size-4" />
        </Button>
        <WeekPicker weekStart={weekStart} onChange={jumpToWeek} />
      </>
    )
  ) : (
    <>
      <Button variant="outline" size="icon-sm" onClick={() => navigateWeek(-1)} aria-label={t("prevWeek")}>
        <ChevronLeft className="size-4" />
      </Button>
      <WeekPicker weekStart={weekStart} onChange={jumpToWeek} />
      <Button variant="outline" size="icon-sm" onClick={() => navigateWeek(1)} aria-label={t("nextWeek")}>
        <ChevronRight className="size-4" />
      </Button>
    </>
  )

  // Status of the week currently in view, derived per shift (informational;
  // the roll-out itself spans every draft week, handled in the dialog).
  const visibleShifts = (schedule?.shifts ?? []).filter((s) => !s.cancelledAt && s.colorTag !== "sick")
  const draftCount = visibleShifts.filter((s) => !s.publishedAt).length
  const isRolledOut = visibleShifts.length > 0 && draftCount === 0

  const publishBtn = (
    <div className="flex items-center gap-2 shrink-0">
      {draftCount > 0 ? (
        <span className="hidden sm:inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          {draftCount === 1 ? "1 draft shift" : `${draftCount} draft shifts`}
        </span>
      ) : isRolledOut ? (
        <span className="hidden sm:inline-flex items-center rounded-full bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:text-green-300">
          {t("rolledOut")}
        </span>
      ) : null}
      <Button
        size="sm"
        onClick={() => setRollOutOpen(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white"
      >
        {t("rollOut")}
      </Button>
    </div>
  )

  const offerBtn = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setOfferDialogOpen(true)}
      className="shrink-0"
    >
      <Megaphone className="size-4" />
      <span className="hidden sm:inline">{t("offerShift")}</span>
    </Button>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Desktop header — single row (md+) */}
      <div className="hidden md:flex flex-wrap items-center gap-2 gap-y-2 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50 shrink-0">{t("title")}</h1>
        {viewToggle}
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={goToToday}
          className={todayHidden ? "opacity-0 pointer-events-none" : ""}
        >
          {t("today")}
        </Button>
        {dayCountSelector}
        {navControls}
        <div className="w-px h-4 bg-gray-200 shrink-0" />
        {offerBtn}
        {publishBtn}
      </div>

      {/* Mobile header — two rows (<md) */}
      <div className="md:hidden border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2 px-4 py-2">
          {viewToggle}
          <div className="flex-1" />
          {offerBtn}
          {publishBtn}
        </div>
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-gray-100 dark:border-gray-800">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className={todayHidden ? "invisible" : ""}
          >
            {t("today")}
          </Button>
          {dayCountSelector}
          <div className="flex-1 flex items-center justify-end gap-1">
            {navControls}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto pb-16 md:pb-0">
        {!loading && employees.length > 0 && (
          <div className="px-3 pt-2 sm:px-4 sm:pt-4">
            <CoverRequestsPanel onFocus={focusCover} />
            <ShiftOffersPanel orgId={orgId} refreshToken={offersRefresh} />
          </div>
        )}
        {!loading && !hintDismissed && employees.length > 0 && (schedule?.shifts ?? []).length === 0 && (
          <div className="mx-4 mt-4 mb-2 flex items-center gap-3 rounded-xl border border-blue-200 dark:border-gray-700 bg-blue-50 dark:bg-gray-800/60 px-4 py-3">
            <Sparkles className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="flex-1 text-sm text-blue-900 dark:text-gray-300">
              <span className="font-semibold">{t("hintBold")}</span>{" "}
              {t("hintRest")}
            </span>
            <button
              onClick={() => setHintDismissed(true)}
              aria-label={t("dismiss")}
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
              <div className="size-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mx-auto mb-4">
                <Users className="size-8 text-blue-400" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-1">{t("noEmployees")}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {t("noEmployeesHint")}
              </p>
              <Link href="/employees">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <UserPlus className="size-4" />
                  {t("addFirstEmployee")}
                </Button>
              </Link>
            </div>
          </div>
        ) : viewMode === "week" ? (
          <WeeklyScheduleGrid
            schedule={schedule ?? placeholderSchedule}
            employees={employees}
            jobRoles={jobRoles}
            shiftTemplates={shiftTemplates}
            scheduledHoursMap={scheduledHoursMap}
            approvedTimeOff={approvedTimeOff}
            getConflict={getConflict}
            coverFocus={coverFocus}
            onShiftMove={handleShiftMove}
            onShiftCreate={handleShiftCreate}
            onShiftUpdate={handleShiftUpdate}
            onShiftDelete={handleShiftDelete}
            onShiftCancel={handleShiftCancel}
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
            getConflict={getConflict}
            startHour={timelineStartHour}
            endHour={timelineEndHour}
            onShiftCreate={handleShiftCreate}
            onShiftUpdate={handleShiftUpdate}
            onShiftDelete={handleShiftDelete}
            onShiftCancel={handleShiftCancel}
          />
        )}
      </div>

      <RollOutDialog
        open={rollOutOpen}
        onOpenChange={setRollOutOpen}
        orgId={orgId}
        onRolledOut={() => reloadSchedule()}
      />

      <OfferShiftDialog
        open={offerDialogOpen}
        onOpenChange={setOfferDialogOpen}
        orgId={orgId}
        jobRoles={jobRoles}
        employees={employees}
        onCreated={() => setOffersRefresh((n) => n + 1)}
      />
    </div>
  )
}
