"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { getMondayOfWeek, addDays, getISOWeek, formatWeekLabel, todayISO } from "@/lib/dateUtils"
import { cn } from "@/lib/utils"
import { useLocale } from "next-intl"
import { LOCALE_TAGS, type Locale } from "@skemaka/i18n"

interface WeekPickerProps {
  weekStart: string
  onChange: (value: string) => void
  /** In day mode, clicking a day calls onChange(day) and highlights the selected day, not the whole week. */
  dayMode?: boolean
  selectedDay?: string
}

/**
 * Month and weekday names come from Intl rather than a hardcoded English list —
 * the calendar sits on the schedule screen, so in a Danish org it was showing
 * "August 2026 / Mo Tu We" directly beside an otherwise fully Danish UI.
 * Any Monday works as the seed for the weekday row; 2024-01-01 was one.
 */
function monthNames(localeTag: string): string[] {
  const fmt = new Intl.DateTimeFormat(localeTag, { month: "long", timeZone: "UTC" })
  return Array.from({ length: 12 }, (_, m) => fmt.format(new Date(Date.UTC(2024, m, 1))))
}

function dayHeaders(localeTag: string): string[] {
  const fmt = new Intl.DateTimeFormat(localeTag, { weekday: "short", timeZone: "UTC" })
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))).slice(0, 2))
}

function getCalendarWeeks(year: number, month: number): string[][] {
  // First Monday on or before the 1st of the month
  const start = getMondayOfWeek(new Date(year, month, 1))
  // Last Sunday on or after the last day of the month
  const lastDay = new Date(year, month + 1, 0)
  const end = addDays(getMondayOfWeek(lastDay), 6)

  const weeks: string[][] = []
  let current = start
  while (current <= end) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(current, i)))
    current = addDays(current, 7)
  }
  return weeks
}

export function WeekPicker({ weekStart, onChange, dayMode, selectedDay }: WeekPickerProps) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => new Date(weekStart + "T12:00:00").getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date(weekStart + "T12:00:00").getMonth())
  const containerRef = useRef<HTMLDivElement>(null)

  // Follow external week/day changes when picker is closed.
  // Uses the "adjust state during render" pattern to avoid setState in an effect.
  const anchorKey = `${open ? 1 : 0}__${dayMode ? (selectedDay ?? "") : weekStart}`
  const [prevAnchorKey, setPrevAnchorKey] = useState(anchorKey)
  if (!open && anchorKey !== prevAnchorKey) {
    setPrevAnchorKey(anchorKey)
    const anchor = dayMode && selectedDay ? selectedDay : weekStart
    const d = new Date(anchor + "T12:00:00")
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const today = todayISO()
  const localeTag = LOCALE_TAGS[useLocale() as Locale]
  const months = useMemo(() => monthNames(localeTag), [localeTag])
  const dayLabels = useMemo(() => dayHeaders(localeTag), [localeTag])
  const isoWeek = getISOWeek(weekStart)
  const weeks = getCalendarWeeks(viewYear, viewMonth)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const handleDayClick = (day: string) => {
    onChange(dayMode ? day : getMondayOfWeek(new Date(day + "T12:00:00")))
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors select-none",
          open ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
        )}
      >
        <span className="text-sm font-bold tabular-nums">W{isoWeek}</span>
        <span className="text-sm text-gray-500 hidden sm:block">{formatWeekLabel(weekStart, localeTag)}</span>
      </button>

      {/* Calendar dropdown */}
      {open && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 w-72">
          {/* Month header */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevMonth}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4 text-gray-500 dark:text-gray-400" />
            </button>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {months[viewMonth]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="size-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1.75rem_repeat(7,1fr)] mb-1">
            <div className="text-[10px] font-medium text-gray-300 dark:text-gray-600 text-center">Wk</div>
            {dayLabels.map(d => (
              <div key={d} className="text-[10px] font-medium text-gray-400 dark:text-gray-500 text-center">{d}</div>
            ))}
          </div>

          {/* Week rows */}
          <div className="space-y-0.5">
            {weeks.map((week) => {
              const isWeekSelected = !dayMode && week[0] === weekStart
              const isDayInWeek = dayMode && selectedDay ? week.includes(selectedDay) : false
              const wk = getISOWeek(week[0])
              return (
                <div
                  key={week[0]}
                  className={cn(
                    "grid grid-cols-[1.75rem_repeat(7,1fr)] rounded-lg",
                    isWeekSelected && "bg-blue-50 dark:bg-blue-950/40"
                  )}
                >
                  {/* Week number */}
                  <div className={cn(
                    "text-[10px] font-medium flex items-center justify-center",
                    (isWeekSelected || isDayInWeek) ? "text-blue-500" : "text-gray-300 dark:text-gray-600"
                  )}>
                    {wk}
                  </div>

                  {/* Day cells */}
                  {week.map((day) => {
                    const inMonth = new Date(day + "T12:00:00").getMonth() === viewMonth
                    const isToday = day === today
                    const isDaySelected = dayMode && day === selectedDay
                    const dayNum = new Date(day + "T12:00:00").getDate()
                    return (
                      <button
                        key={day}
                        onClick={() => handleDayClick(day)}
                        className={cn(
                          "py-1 flex items-center justify-center rounded-md transition-colors",
                          isWeekSelected ? "hover:bg-blue-100 dark:hover:bg-blue-900/40" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        )}
                      >
                        <span className={cn(
                          "text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium",
                          inMonth ? "text-gray-700 dark:text-gray-200" : "text-gray-300 dark:text-gray-600",
                          isToday && !isDaySelected && "ring-2 ring-blue-400 font-bold",
                          isWeekSelected && isToday && "ring-blue-500",
                          isDaySelected && "bg-blue-500 text-white",
                        )}>
                          {dayNum}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
