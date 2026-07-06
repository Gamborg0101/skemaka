"use client"

import React from "react"
import { Plus, CalendarCheck, Thermometer } from "lucide-react"
import type { AvailabilityRequest, Employee, AvailabilitySubmission, AvailabilityDay, Shift } from "@/types"
import { getWeekDays, formatTime } from "@/lib/dateUtils"
import { getOrgSettings } from "@/lib/orgSettings"

interface AvailabilityGridProps {
  request: AvailabilityRequest
  employees: Employee[]
  shifts: Shift[]
  onBookShift: (employeeId: string, date: string, startTime: string | null, endTime: string | null) => void
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function DayCell({
  day,
  existingShift,
  noSubmission,
  onBook,
}: {
  day: AvailabilityDay | undefined
  existingShift: Shift | undefined
  noSubmission?: boolean
  onBook?: () => void
}) {
  const tf = getOrgSettings().timeFormat
  if (existingShift) {
    // A sick day is a zero-duration marker (00:00–00:00), not a worked shift —
    // render it as "Sick" rather than a nonsensical "00:00–00:00" time range.
    if (existingShift.colorTag === "sick") {
      return (
        <div className="h-full min-h-12 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex flex-col items-center justify-center gap-0.5 px-1">
          <Thermometer className="size-3.5 text-rose-500 dark:text-rose-400" />
          <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">
            Sick
          </span>
        </div>
      )
    }
    return (
      <div className="h-full min-h-12 rounded bg-blue-50 dark:bg-slate-800/60 border border-blue-200 dark:border-slate-600 flex flex-col items-center justify-center gap-0.5 px-1">
        <CalendarCheck className="size-3.5 text-blue-500 dark:text-slate-300" />
        <span className="text-[10px] font-semibold text-blue-700 dark:text-slate-200 tabular-nums">
          {formatTime(existingShift.startTime, tf)}–{formatTime(existingShift.endTime, tf)}
        </span>
      </div>
    )
  }

  if (!day) {
    return noSubmission ? (
      <div className="h-full min-h-12 rounded bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 flex items-center justify-center">
        <span className="text-xs text-red-300 dark:text-red-700">—</span>
      </div>
    ) : (
      <div className="h-full min-h-12 rounded border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
      </div>
    )
  }

  if (!day.isAvailable) {
    return (
      <div className="h-full min-h-12 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Unavailable</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onBook}
      className="group w-full h-full min-h-12 rounded bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 flex flex-col items-center justify-center gap-0.5 px-1 hover:bg-green-100 dark:hover:bg-green-900/50 hover:border-green-400 dark:hover:border-green-700 transition-colors cursor-pointer"
    >
      <span className="text-xs font-semibold text-green-700 dark:text-green-300 tabular-nums">
        {day.startTime && day.endTime
          ? `${formatTime(day.startTime, tf)}–${formatTime(day.endTime, tf)}`
          : "Full day"}
      </span>
      <span className="flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        <Plus className="size-2.5" />
        Book shift
      </span>
    </button>
  )
}

export function AvailabilityGrid({ request, employees, shifts, onBookShift }: AvailabilityGridProps) {
  const days = getWeekDays(request.weekStart)
  const submissions: AvailabilitySubmission[] = request.submissions ?? []

  const submittedCount = submissions.length
  const totalCount = employees.length

  if (totalCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-20 text-center">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No employees</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add employees to see their availability.</p>
      </div>
    )
  }

  const getSubmission = (employeeId: string): AvailabilitySubmission | undefined =>
    submissions.find((s) => s.employeeId === employeeId)

  const getDayData = (
    submission: AvailabilitySubmission | undefined,
    date: string
  ): AvailabilityDay | undefined =>
    submission?.days?.find((d) => d.date === date)

  const getShift = (employeeId: string, date: string): Shift | undefined =>
    shifts.find((s) => s.employeeId === employeeId && s.date === date)

  // A sick-day marker isn't a scheduled working shift, so it shouldn't count
  // toward "scheduled this week".
  const scheduledCount = employees.filter((emp) =>
    days.some((date) => {
      const shift = getShift(emp.id, date)
      return shift && shift.colorTag !== "sick"
    })
  ).length

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-gray-100">{submittedCount}</span>
          {" / "}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{totalCount}</span>
          {" submitted"}
        </span>
        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden min-w-16">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${totalCount > 0 ? (submittedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
        {scheduledCount > 0 && (
          <span className="text-xs text-blue-600 font-medium">
            {scheduledCount} scheduled this week
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-blue-100 dark:bg-slate-700/60 border border-blue-300 dark:border-slate-500" />
          Scheduled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
          Unavailable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900" />
          Sick
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800" />
          Not submitted
        </span>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div
          className="grid"
          style={{ gridTemplateColumns: "160px repeat(7, minmax(100px, 1fr))" }}
        >
          {/* Header */}
          <div className="border-b border-r border-gray-200 dark:border-gray-700 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Employee
            </span>
          </div>
          {days.map((date, i) => (
            <div
              key={date}
              className="border-b border-r border-gray-200 dark:border-gray-700 px-2 py-2.5 text-center last:border-r-0"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {DAY_NAMES[i]}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </div>
          ))}

          {/* Employee rows */}
          {employees.map((employee) => {
            const submission = getSubmission(employee.id)
            const hasSubmitted = !!submission
            return (
              <React.Fragment key={employee.id}>
                <div className="border-b border-r border-gray-100 dark:border-gray-800 px-3 py-2 flex flex-col justify-center last:border-b-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{employee.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{employee.jobRole}</p>
                  {!hasSubmitted && (
                    <span className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">Not submitted</span>
                  )}
                </div>
                {days.map((date) => {
                  const dayData = getDayData(submission, date)
                  const existingShift = getShift(employee.id, date)
                  return (
                    <div
                      key={`${employee.id}-${date}`}
                      className="border-b border-r border-gray-100 dark:border-gray-800 p-1.5 last:border-r-0 last:border-b-0"
                    >
                      <DayCell
                        day={dayData}
                        existingShift={existingShift}
                        noSubmission={!hasSubmitted}
                        onBook={
                          dayData?.isAvailable && !existingShift
                            ? () => onBookShift(employee.id, date, dayData.startTime, dayData.endTime)
                            : undefined
                        }
                      />
                    </div>
                  )
                })}
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}
