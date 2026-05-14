// Module-level schedule store shared across manager pages.
// SAFE: only imported by "use client" files — never runs during SSR.
// TODO: replace with /api/organizations/[orgId]/schedules calls.

import type { Schedule, Shift } from "@/types"
import { addDays } from "@/lib/dateUtils"

function buildSeedSchedule(weekStart: string): Schedule {
  const shifts: Shift[] = [
    {
      id: "shift-1",
      scheduleId: "sched-1",
      organizationId: "org-1",
      employeeId: "emp-1",
      date: weekStart,
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
      employeeId: "emp-2",
      date: weekStart,
      startTime: "10:00",
      endTime: "18:00",
      breakMinutes: 30,
      jobRole: "Server",
      notes: null,
      colorTag: "green",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
    {
      id: "shift-3",
      scheduleId: "sched-1",
      organizationId: "org-1",
      employeeId: "emp-1",
      date: addDays(weekStart, 1),
      startTime: "09:00",
      endTime: "17:00",
      breakMinutes: 30,
      jobRole: "Barista",
      notes: null,
      colorTag: "blue",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
    {
      id: "shift-4",
      scheduleId: "sched-1",
      organizationId: "org-1",
      employeeId: "emp-3",
      date: addDays(weekStart, 2),
      startTime: "07:00",
      endTime: "14:00",
      breakMinutes: 0,
      jobRole: "Kitchen",
      notes: "Prep shift",
      colorTag: "orange",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
    {
      id: "shift-5",
      scheduleId: "sched-1",
      organizationId: "org-1",
      employeeId: "emp-4",
      date: addDays(weekStart, 4),
      startTime: "12:00",
      endTime: "20:00",
      breakMinutes: 30,
      jobRole: "Barista",
      notes: null,
      colorTag: "blue",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
  ]

  return {
    id: "sched-1",
    organizationId: "org-1",
    weekStart,
    isDuplicate: false,
    sourceScheduleId: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    shifts,
  }
}

const _schedules = new Map<string, Schedule>()

export function getSchedule(weekStart: string): Schedule {
  if (!_schedules.has(weekStart)) {
    _schedules.set(weekStart, buildSeedSchedule(weekStart))
  }
  return _schedules.get(weekStart)!
}

export function mutateSchedule(weekStart: string, updater: (prev: Schedule) => Schedule): Schedule {
  const next = updater(getSchedule(weekStart))
  _schedules.set(weekStart, next)
  return next
}
