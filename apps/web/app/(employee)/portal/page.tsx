import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Clock, MapPin, Users, ArrowLeft } from "lucide-react"
import { getMondayOfWeek, formatWeekLabel, formatTime, calcHours } from "@/lib/dateUtils"
import { getInitials } from "@/lib/utils"
import { pickShiftQuote } from "@/types"
import { TimeOffSection } from "./TimeOffSection"

function formatShiftDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })
}

type DbShift = {
  id: string; date: Date; startTime: string; endTime: string
  breakMinutes: number; jobRole: string; notes: string | null; colorTag: string | null
}

type Coworker = { name: string; jobRole: string }

function groupByWeek(shifts: DbShift[]) {
  const map = new Map<string, DbShift[]>()
  for (const shift of shifts) {
    const key = getMondayOfWeek(shift.date)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(shift)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
}

const TAG_COLORS: Record<string, string> = {
  blue:   "bg-blue-100 text-blue-700",
  green:  "bg-green-100 text-green-700",
  orange: "bg-orange-100 text-orange-700",
  purple: "bg-purple-100 text-purple-700",
  yellow: "bg-yellow-100 text-yellow-700",
  gray:   "bg-gray-100 text-gray-600",
}

function avatarColor(name: string) {
  const colors = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-rose-500", "bg-amber-500", "bg-cyan-500"]
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return colors[hash % colors.length]
}

export default async function EmployeePortalPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const isManager = session.user?.role === "MANAGER" || session.user?.role === "ADMIN"

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  // Show from Monday of the current week so the full week is always visible
  const dayOfWeek = today.getUTCDay()
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const currentWeekStart = new Date(today)
  currentWeekStart.setUTCDate(today.getUTCDate() + daysToMonday)

  const employee = await db.employee.findFirst({
    where: { email: session.user.email, isActive: true },
    include: {
      organization: { select: { name: true, settings: true, industry: true } },
      shifts: {
        where: { date: { gte: currentWeekStart } },
        orderBy: { date: "asc" },
        take: 60,
      },
    },
  })

  if (!employee) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="text-center max-w-sm">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">No employee profile</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ask your manager to add you as an employee so your shifts appear here.
          </p>
        </div>
      </div>
    )
  }

  const tf = (employee.organization.settings as { timeFormat?: "12h" | "24h" } | null)?.timeFormat ?? "24h"

  // Fetch schedule publishedAt for each week shown
  const weekStarts = [...new Set(employee.shifts.map((s) => getMondayOfWeek(s.date)))]
  const schedules = weekStarts.length > 0
    ? await db.schedule.findMany({
        where: {
          organizationId: employee.organizationId,
          weekStart: { in: weekStarts.map((w) => new Date(w + "T00:00:00Z")) },
        },
        select: { weekStart: true, publishedAt: true },
        orderBy: { createdAt: "asc" },
      })
    : []
  const publishedWeeks = new Set(
    schedules.filter((s) => s.publishedAt).map((s) => getMondayOfWeek(s.weekStart))
  )

  // Fetch all other people working on the same dates
  const shiftDates = employee.shifts.map((s) => s.date)
  const coworkerShifts = shiftDates.length > 0
    ? await db.shift.findMany({
        where: {
          organizationId: employee.organizationId,
          date: { in: shiftDates },
          employeeId: { not: employee.id },
        },
        select: {
          date: true,
          jobRole: true,
          employee: { select: { name: true, jobRole: true } },
        },
      })
    : []

  // Map: dateKey → coworker list
  const coworkersByDate = new Map<string, Coworker[]>()
  for (const s of coworkerShifts) {
    const key = s.date.toISOString().split("T")[0]
    if (!coworkersByDate.has(key)) coworkersByDate.set(key, [])
    coworkersByDate.get(key)!.push({ name: s.employee.name, jobRole: s.jobRole })
  }

  const weeks = groupByWeek(employee.shifts)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-10">
      {/* Back bar — only for managers */}
      {isManager && (
        <div className="bg-gray-900 px-4 py-2.5 flex items-center gap-2">
          <Link
            href="/schedule"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to dashboard
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {employee.organization.name}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
          Hi {employee.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{employee.jobRole}</p>
      </div>

      {/* Shift list */}
      <div className="px-4 py-5 max-w-lg mx-auto space-y-6">
        {weeks.length === 0 && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <p className="text-lg font-medium">No upcoming shifts</p>
            <p className="text-sm mt-1">Check back when your schedule is published.</p>
          </div>
        )}

        {weeks.map(([weekStart, weekShifts]) => (
          <div key={weekStart}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {formatWeekLabel(weekStart)}
              </h2>
              {publishedWeeks.has(weekStart) ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-px rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  Published
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-px rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                  Pending
                </span>
              )}
            </div>

            <div className="space-y-3">
              {weekShifts.map((shift) => {
                const hours = calcHours(shift.startTime, shift.endTime, shift.breakMinutes)
                const dateKey = shift.date.toISOString().split("T")[0]
                const coworkers = coworkersByDate.get(dateKey) ?? []
                const tagClass = TAG_COLORS[shift.colorTag ?? "gray"] ?? TAG_COLORS.gray

                return (
                  <div
                    key={shift.id}
                    className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden"
                  >
                    <div className="px-4 py-4 space-y-3">
                      {/* Date + role badge */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatShiftDate(shift.date)}
                        </p>
                        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${tagClass}`}>
                          {shift.jobRole}
                        </span>
                      </div>

                      {/* Time */}
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                        <Clock className="size-4 shrink-0 text-gray-400 dark:text-gray-500" />
                        <span className="text-sm font-medium">
                          {formatTime(shift.startTime, tf)} – {formatTime(shift.endTime, tf)}
                        </span>
                        <span className="text-sm text-gray-400 dark:text-gray-500">
                          · {hours}h
                          {shift.breakMinutes > 0 && ` (incl. ${shift.breakMinutes}m break)`}
                        </span>
                      </div>

                      {/* Location */}
                      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                        <MapPin className="size-4 shrink-0 text-gray-400 dark:text-gray-500" />
                        <span className="text-sm">{employee.organization.name}</span>
                      </div>

                      {/* Notes — the manager's note, or a friendly fallback line */}
                      {shift.notes ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                          {shift.notes}
                        </p>
                      ) : (
                        <p className="text-sm italic text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg px-3 py-2 leading-relaxed">
                          &ldquo;{pickShiftQuote(shift.id, employee.organization.industry)}&rdquo;
                        </p>
                      )}

                      {/* Co-workers */}
                      {coworkers.length > 0 && (
                        <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Users className="size-3.5 text-gray-400 dark:text-gray-500" />
                            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                              Working with you
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {coworkers.map((cw) => (
                              <div key={cw.name} className="flex items-center gap-1.5">
                                <div className={`size-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${avatarColor(cw.name)}`}>
                                  {getInitials(cw.name)}
                                </div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">{cw.name}</span>
                                <span className="text-xs text-gray-400 dark:text-gray-500">· {cw.jobRole}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {(employee.organization.settings as { timeOffEnabled?: boolean } | null)?.timeOffEnabled !== false && (
          <TimeOffSection orgId={employee.organizationId} />
        )}
      </div>
    </div>
  )
}
