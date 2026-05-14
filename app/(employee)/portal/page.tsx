// TODO: fetch from /api/employee/portal (auth: magic link session)
// TODO: fetch from /api/employee/shifts?upcoming=true

import { MapPin, Clock } from "lucide-react"
import type { Shift, Employee } from "@/types"
import { getMondayOfWeek, formatWeekLabel, formatTime, calcHours } from "@/lib/dateUtils"

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_EMPLOYEE: Employee = {
  id: "emp-1",
  organizationId: "org-1",
  userId: null,
  name: "Sophie Andersen",
  email: "sophie@example.com",
  phone: null,
  jobRole: "Barista",
  hourlyWage: 15.5,
  notes: null,
  employmentType: "PART_TIME" as const,
      contractedHours: 0,
      isActive: true,
  inviteToken: null,
  inviteExpiry: null,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
}

const MOCK_SHIFTS: Shift[] = [
  {
    id: "shift-1",
    scheduleId: "sched-1",
    organizationId: "org-1",
    employeeId: "emp-1",
    date: "2026-05-18",
    startTime: "08:00",
    endTime: "16:00",
    breakMinutes: 30,
    jobRole: "Barista",
    notes: null,
    colorTag: "blue",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "shift-2",
    scheduleId: "sched-1",
    organizationId: "org-1",
    employeeId: "emp-1",
    date: "2026-05-19",
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 30,
    jobRole: "Barista",
    notes: "Opening shift",
    colorTag: "blue",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "shift-3",
    scheduleId: "sched-1",
    organizationId: "org-1",
    employeeId: "emp-1",
    date: "2026-05-22",
    startTime: "08:00",
    endTime: "13:00",
    breakMinutes: 0,
    jobRole: "Barista",
    notes: null,
    colorTag: "blue",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "shift-4",
    scheduleId: "sched-2",
    organizationId: "org-1",
    employeeId: "emp-1",
    date: "2026-05-25",
    startTime: "08:00",
    endTime: "16:00",
    breakMinutes: 30,
    jobRole: "Barista",
    notes: null,
    colorTag: "blue",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "shift-5",
    scheduleId: "sched-2",
    organizationId: "org-1",
    employeeId: "emp-1",
    date: "2026-05-27",
    startTime: "12:00",
    endTime: "20:00",
    breakMinutes: 30,
    jobRole: "Barista",
    notes: "Closing shift",
    colorTag: "blue",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "shift-6",
    scheduleId: "sched-2",
    organizationId: "org-1",
    employeeId: "emp-1",
    date: "2026-05-28",
    startTime: "09:00",
    endTime: "14:00",
    breakMinutes: 0,
    jobRole: "Barista",
    notes: null,
    colorTag: "blue",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
]

const ORG_NAME = "The Daily Grind"
const LOCATION = "Main Street Branch"

// ── Helpers ───────────────────────────────────────────────────────────────────


function formatShiftDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

// Group shifts by their week
function groupShiftsByWeek(shifts: Shift[]): Map<string, Shift[]> {
  const map = new Map<string, Shift[]>()
  for (const shift of shifts) {
    const weekKey = getMondayOfWeek(new Date(shift.date + "T12:00:00"))
    if (!map.has(weekKey)) map.set(weekKey, [])
    map.get(weekKey)!.push(shift)
  }
  // Sort each group by date
  for (const [, group] of map) {
    group.sort((a, b) => a.date.localeCompare(b.date))
  }
  return map
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmployeePortalPage() {
  const employee = MOCK_EMPLOYEE
  const shifts = MOCK_SHIFTS
  const grouped = groupShiftsByWeek(shifts)
  const weeks = Array.from(grouped.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {ORG_NAME}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          Hi {employee.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{employee.jobRole}</p>
      </div>

      {/* Shift list */}
      <div className="px-4 py-5 max-w-lg mx-auto space-y-6">
        {weeks.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No upcoming shifts</p>
            <p className="text-sm mt-1">Check back when your schedule is published.</p>
          </div>
        )}

        {weeks.map(([weekStart, weekShifts]) => (
          <div key={weekStart}>
            {/* Week label */}
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
              {formatWeekLabel(weekStart)}
            </h2>

            <div className="space-y-3">
              {weekShifts.map((shift) => {
                const hours = calcHours(
                  shift.startTime,
                  shift.endTime,
                  shift.breakMinutes
                )
                return (
                  <div
                    key={shift.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                  >
                    <div className="px-4 py-4">
                      <p className="font-semibold text-gray-900">
                        {formatShiftDate(shift.date)}
                      </p>

                      <div className="flex items-center gap-1.5 mt-2 text-gray-600">
                        <Clock className="size-4 shrink-0 text-gray-400" />
                        <span className="text-sm font-medium">
                          {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                        </span>
                        <span className="text-sm text-gray-400">
                          &middot; {hours}h
                          {shift.breakMinutes > 0 &&
                            ` (incl. ${shift.breakMinutes}m break)`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1.5 text-gray-500">
                        <MapPin className="size-4 shrink-0 text-gray-400" />
                        <span className="text-sm">{LOCATION}</span>
                      </div>

                      {shift.notes && (
                        <p className="mt-2.5 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                          {shift.notes}
                        </p>
                      )}
                    </div>

                    <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50">
                      <span className="text-xs font-medium text-gray-500">
                        {shift.jobRole}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
