import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatTime, calcNetHours, getMondayOfWeek, addDays } from "@/lib/dateUtils"
import { cn } from "@/lib/utils"
import { CoworkerList } from "@/components/manager/CoworkerList"
import { EmployeePicker } from "@/components/manager/EmployeePicker"
import { MyShiftsWeekNav } from "@/components/manager/MyShiftsWeekNav"
import { OfferCoverButton } from "@/components/employee/OfferCoverButton"
import { CoverPoolPanel } from "@/components/employee/CoverPoolPanel"
import { MyShiftOffersPanel } from "@/components/employee/MyShiftOffersPanel"
import { pickShiftQuote } from "@/types"

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDay(date: Date) {
  return date.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })
}
function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })
}

type DbShift = {
  id: string; date: Date; startTime: string; endTime: string
  breakMinutes: number; jobRole: string; notes: string | null; colorTag: string | null
  cancelledAt: Date | null
}
type Coworker = { name: string; jobRole: string }

const ACCENT: Record<string, { badge: string }> = {
  blue:   { badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
  green:  { badge: "bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300" },
  orange: { badge: "bg-orange-50 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" },
  purple: { badge: "bg-purple-50 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" },
  yellow: { badge: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300" },
  gray:   { badge: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MyShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string; week?: string }>
}) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const { employee: employeeParam, week: weekParam } = await searchParams

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayKey = today.toISOString().split("T")[0]

  // Resolve the selected week — default to current week's Monday
  const weekStart = (() => {
    if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
      return getMondayOfWeek(new Date(weekParam + "T12:00:00"))
    }
    return getMondayOfWeek(new Date())
  })()
  const weekEnd = addDays(weekStart, 7)

  // Find the logged-in user's own employee record first
  const selfEmployee = await db.employee.findFirst({
    where: { email: session.user.email, isActive: true },
    select: { id: true, organizationId: true, jobRole: true, organization: { select: { name: true } } },
  })

  if (!selfEmployee) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4">
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">No employee profile found</p>
        <p className="text-sm text-gray-500">Add yourself as an employee to see your shifts here.</p>
      </div>
    )
  }

  // All active employees in the org for the picker
  const allEmployees = await db.employee.findMany({
    where: { organizationId: selfEmployee.organizationId, isActive: true },
    select: { id: true, name: true, jobRole: true },
    orderBy: { name: "asc" },
  })

  // Resolve which employee we're viewing
  const selectedId = employeeParam && allEmployees.some((e) => e.id === employeeParam)
    ? employeeParam
    : selfEmployee.id

  const viewingSelf = selectedId === selfEmployee.id

  // Fetch the selected employee's profile + shifts for the selected week
  const employee = await db.employee.findUnique({
    where: { id: selectedId },
    include: {
      organization: { select: { name: true, settings: true, industry: true } },
      shifts: {
        where: {
          date: {
            gte: new Date(weekStart + "T00:00:00.000Z"),
            lt: new Date(weekEnd + "T00:00:00.000Z"),
          },
        },
        orderBy: { date: "asc" },
      },
    },
  })

  if (!employee) redirect("/my-shifts")

  const tf = (employee.organization.settings as { timeFormat?: "12h" | "24h" } | null)?.timeFormat ?? "24h"
  const shifts: DbShift[] = employee.shifts
  const shiftDates = shifts.map((s) => s.date)

  const coworkerShifts = shiftDates.length > 0
    ? await db.shift.findMany({
        where: {
          organizationId: employee.organizationId,
          date: { in: shiftDates },
          employeeId: { not: employee.id },
          cancelledAt: null,
        },
        select: { date: true, jobRole: true, employee: { select: { name: true } } },
      })
    : []

  const coworkersByDate = new Map<string, Coworker[]>()
  for (const s of coworkerShifts) {
    const key = s.date.toISOString().split("T")[0]
    if (!coworkersByDate.has(key)) coworkersByDate.set(key, [])
    coworkersByDate.get(key)!.push({ name: s.employee.name, jobRole: s.jobRole })
  }

  const nextShiftId = shifts.find((s) => s.date >= today && !s.cancelledAt)?.id

  // Which of my shifts are already up for cover (to seed the per-shift button).
  const myActiveCover = viewingSelf
    ? await db.shiftCoverRequest.findMany({
        where: { requesterEmployeeId: selfEmployee.id, status: { in: ["OPEN", "CLAIMED"] } },
        select: { id: true, shiftId: true, status: true },
      })
    : []
  const coverByShift = new Map<string, { id: string; status: "OPEN" | "CLAIMED" }>()
  for (const c of myActiveCover) {
    coverByShift.set(c.shiftId, { id: c.id, status: c.status as "OPEN" | "CLAIMED" })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Desktop header */}
      <div className="hidden md:flex items-center justify-between gap-3 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {viewingSelf ? "My Shifts" : `${employee.name}'s Shifts`}
          </h1>
          <p className="text-xs text-gray-500">
            {employee.jobRole} · {employee.organization.name}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MyShiftsWeekNav weekStart={weekStart} employeeParam={viewingSelf ? undefined : selectedId} />
          {allEmployees.length > 1 && (
            <EmployeePicker
              employees={allEmployees}
              selectedId={selectedId}
              selfId={selfEmployee.id}
            />
          )}
        </div>
      </div>
      {/* Mobile header */}
      <div className="md:hidden px-4 pt-6 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {viewingSelf ? "My Shifts" : `${employee.name}'s Shifts`}
            </h1>
            <p className="text-xs text-gray-500">
              {employee.jobRole} · {employee.organization.name}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <MyShiftsWeekNav weekStart={weekStart} employeeParam={viewingSelf ? undefined : selectedId} />
            {allEmployees.length > 1 && (
              <EmployeePicker
                employees={allEmployees}
                selectedId={selectedId}
                selfId={selfEmployee.id}
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 md:px-6 py-6 pb-20 md:pb-6">
      {viewingSelf && <MyShiftOffersPanel orgId={selfEmployee.organizationId} />}
      {viewingSelf && <CoverPoolPanel orgId={selfEmployee.organizationId} />}
      {shifts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base font-medium">No shifts this week</p>
          <p className="text-sm mt-1">
            {viewingSelf
              ? "No shifts are scheduled for this week."
              : `${employee.name} has no shifts this week.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map((shift) => {
            const hours = calcNetHours(shift.startTime, shift.endTime, shift.breakMinutes)
            const dateKey = shift.date.toISOString().split("T")[0]
            const isCancelled = !!shift.cancelledAt
            const coworkers = isCancelled ? [] : (coworkersByDate.get(dateKey) ?? [])
            const accent = ACCENT[shift.colorTag ?? "gray"] ?? ACCENT.gray
            const isToday = dateKey === todayKey && !isCancelled
            const isNext = shift.id === nextShiftId

            return (
              <div
                key={shift.id}
                className={cn(
                  "bg-white dark:bg-gray-800/60 rounded-2xl border flex flex-col transition-shadow",
                  isCancelled
                    ? "border-gray-200 dark:border-gray-700 shadow-none opacity-70"
                    : isToday
                      ? "border-blue-300 dark:border-blue-700 shadow-lg shadow-blue-100/60 dark:shadow-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 shadow-sm"
                )}
              >
                <div className="p-4 flex flex-col gap-3 flex-1">
                  {/* Day + badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none">
                        {formatDay(shift.date)}
                      </p>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-0.5">
                        {formatDate(shift.date)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {isCancelled && (
                        <span className="text-[11px] font-bold bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                          Cancelled
                        </span>
                      )}
                      {isToday && (
                        <span className="text-[11px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                          Today
                        </span>
                      )}
                      {isNext && !isToday && (
                        <span className="text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                          Up next
                        </span>
                      )}
                      <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", accent.badge)}>
                        {shift.jobRole}
                      </span>
                    </div>
                  </div>

                  {/* Time — hero */}
                  <div>
                    <p className={cn(
                      "text-2xl font-bold tabular-nums leading-none",
                      isCancelled
                        ? "text-gray-400 dark:text-gray-500 line-through"
                        : "text-gray-900 dark:text-gray-100"
                    )}>
                      {formatTime(shift.startTime, tf)} – {formatTime(shift.endTime, tf)}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {isCancelled
                        ? "This shift was cancelled"
                        : <>{hours}{shift.breakMinutes > 0 ? ` · ${shift.breakMinutes} min break` : " · No break"}</>}
                    </p>
                  </div>

                  {/* Notes */}
                  {!isCancelled && (
                    <p className={cn(
                      "text-xs rounded-lg px-3 py-2 italic leading-relaxed",
                      shift.notes
                        ? "text-gray-500 bg-gray-50 dark:text-gray-400 dark:bg-gray-700/50"
                        : "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40"
                    )}>
                      &ldquo;{shift.notes ?? pickShiftQuote(shift.id, employee.organization.industry)}&rdquo;
                    </p>
                  )}

                  {/* Coworkers */}
                  {coworkers.length > 0 && <CoworkerList coworkers={coworkers} />}

                  {/* Offer this shift up for a teammate to cover (own upcoming shifts only) */}
                  {viewingSelf && !isCancelled && shift.date >= today && (
                    <div className="mt-auto pt-1">
                      <OfferCoverButton
                        orgId={selfEmployee.organizationId}
                        shiftId={shift.id}
                        initial={coverByShift.get(shift.id) ?? null}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}
