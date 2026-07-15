"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, ChevronDown, Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTime } from "@/lib/dateUtils"
import { getOrgSettings } from "@/lib/orgSettings"
import type { Shift } from "@/types"

interface SickDaysSectionProps {
  orgId: string
  employeeId: string
}

function formatSickDate(isoDate: string): string {
  return new Date(isoDate + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function SickDayRow({ shift }: { shift: Shift }) {
  const tf = getOrgSettings().timeFormat
  // Legacy sick days were stored as a bare 00:00–00:00 marker with no hours.
  const hasHours = shift.startTime !== "00:00" || shift.endTime !== "00:00"
  return (
    <div className="py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
          {formatSickDate(shift.date)}
        </p>
        {hasHours && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="size-3" />
            {formatTime(shift.startTime, tf)}–{formatTime(shift.endTime, tf)}
          </span>
        )}
      </div>
      <p
        className={cn(
          "text-sm mt-0.5",
          shift.notes ? "text-gray-600 dark:text-gray-300" : "text-gray-400 dark:text-gray-500 italic",
        )}
      >
        {shift.notes || "No reason recorded"}
      </p>
    </div>
  )
}

export function SickDaysSection({ orgId, employeeId }: SickDaysSectionProps) {
  const [sickDays, setSickDays] = useState<Shift[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [showOlder, setShowOlder] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setShowOlder(false)
    fetch(`/api/orgs/${orgId}/employees/${employeeId}/sick-days`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((res: { data?: Shift[] }) => {
        if (!cancelled) setSickDays(res.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setSickDays([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orgId, employeeId])

  // Split into the last 6 months vs. older so the list doesn't overcrowd.
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 6)
  const cutoffStr = cutoff.toISOString().split("T")[0]
  const recent = (sickDays ?? []).filter((s) => s.date >= cutoffStr)
  const older = (sickDays ?? []).filter((s) => s.date < cutoffStr)
  const total = (sickDays ?? []).length

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2.5">
          <AlertTriangle
            className={cn(
              "size-4 shrink-0",
              total > 0 ? "text-rose-400" : "text-gray-300 dark:text-gray-600",
            )}
          />
          <span className="text-sm text-gray-700 dark:text-gray-200">Sick days</span>
          {!loading && (
            <span
              className={cn(
                "text-xs font-semibold px-1.5 py-0.5 rounded-full",
                total > 0
                  ? "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
              )}
            >
              {total}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-gray-400 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0.5 border-t border-gray-100 dark:border-gray-800">
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          ) : total === 0 ? (
            <p className="py-3 text-sm text-gray-500 dark:text-gray-400">
              No sick days recorded.
            </p>
          ) : (
            <>
              {recent.length > 0 ? (
                recent.map((s) => <SickDayRow key={s.id} shift={s} />)
              ) : (
                <p className="py-2.5 text-sm text-gray-500 dark:text-gray-400">
                  None in the last 6 months.
                </p>
              )}

              {older.length > 0 && !showOlder && (
                <button
                  type="button"
                  onClick={() => setShowOlder(true)}
                  className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Show sick days older than 6 months ({older.length})
                </button>
              )}

              {showOlder && older.map((s) => <SickDayRow key={s.id} shift={s} />)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
