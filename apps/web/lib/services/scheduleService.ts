import { db } from "@/lib/prisma"
import { serSchedule, serShift, serEmployee } from "@/lib/serialize"
import { Prisma } from "@/app/generated/prisma/client"
import {
  sendSchedulePublishedSms,
  sendShiftAssignedSms,
  sendShiftCancelledSms,
  sendShiftUpdatedSms,
} from "@/lib/sms"
import { formatWeekLabel, formatTime, calcHours } from "@/lib/dateUtils"
import type { Schedule, Shift, WeeklyLaborCost, LaborCostEntry } from "@/types"
import type { PaginationParams, Paginated } from "@/lib/validate"
import { ServiceError } from "./errors"

// Full select — only used in manager-only contexts (cost calculations, SMS notifications).
const SHIFT_EMPLOYEE_SELECT = {
  id: true, organizationId: true, userId: true,
  name: true, email: true, phone: true, jobRole: true,
  hourlyWage: true, employmentType: true, contractedHours: true,
  notes: true, isActive: true, createdAt: true, updatedAt: true,
} as const

// Restricted select — used when any org member can read the response.
// Omits salary, contact details, and HR notes so employees cannot read
// each other's sensitive data via the schedule endpoint.
const PUBLIC_SHIFT_EMPLOYEE_SELECT = {
  id: true, name: true, jobRole: true,
} as const

// ── Schedules ─────────────────────────────────────────────────────────────────

export async function getScheduleByWeek(
  orgId: string,
  weekStart: string,
): Promise<Schedule | null> {
  const weekStartDate = new Date(weekStart + "T00:00:00Z")
  const weekEndDate   = new Date(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [schedule, timeEntries] = await Promise.all([
    db.schedule.findFirst({
      where: { organizationId: orgId, weekStart: weekStartDate },
      include: { shifts: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } },
      orderBy: { createdAt: "asc" },
    }),
    db.timeEntry.findMany({
      where: { organizationId: orgId, clockIn: { gte: weekStartDate, lt: weekEndDate } },
      select: { id: true, employeeId: true, clockIn: true, clockOut: true },
    }),
  ])

  if (!schedule) return null

  // Build a map of "employeeId:YYYY-MM-DD" → summary (completed entries only)
  type DaySummary = {
    id: string; workedMinutes: number; firstClockIn: Date; lastClockOut: Date; lastEntryId: string
  }
  const entryMap = new Map<string, DaySummary>()
  for (const entry of timeEntries) {
    if (!entry.clockOut) continue
    const date    = entry.clockIn.toISOString().split("T")[0]
    const key     = `${entry.employeeId}:${date}`
    const minutes = Math.floor((entry.clockOut.getTime() - entry.clockIn.getTime()) / 60_000)
    const existing = entryMap.get(key)
    if (existing) {
      existing.workedMinutes += minutes
      if (entry.clockIn  < existing.firstClockIn) existing.firstClockIn = entry.clockIn
      if (entry.clockOut > existing.lastClockOut) {
        existing.lastClockOut = entry.clockOut
        existing.lastEntryId  = entry.id
      }
    } else {
      entryMap.set(key, {
        id: entry.id, workedMinutes: minutes,
        firstClockIn: entry.clockIn, lastClockOut: entry.clockOut, lastEntryId: entry.id,
      })
    }
  }

  const serialized = serSchedule(schedule)
  if (serialized.shifts) {
    serialized.shifts = serialized.shifts.map((shift) => {
      const summary = entryMap.get(`${shift.employeeId}:${shift.date}`)
      if (!summary) return shift
      return {
        ...shift,
        workedMinutes: summary.workedMinutes,
        clockedInAt:   summary.firstClockIn.toISOString(),
        clockedOutAt:  summary.lastClockOut.toISOString(),
        timeEntryId:   summary.lastEntryId,
      }
    })
  }
  return serialized
}

export async function listSchedules(orgId: string): Promise<Schedule[]>
export async function listSchedules(orgId: string, pagination: PaginationParams): Promise<Paginated<Schedule>>
export async function listSchedules(
  orgId: string,
  pagination?: PaginationParams,
): Promise<Schedule[] | Paginated<Schedule>> {
  if (!pagination) {
    const schedules = await db.schedule.findMany({
      where: { organizationId: orgId },
      orderBy: { weekStart: "desc" },
    })
    return schedules.map(serSchedule)
  }
  const [schedules, total] = await Promise.all([
    db.schedule.findMany({
      where: { organizationId: orgId },
      orderBy: { weekStart: "desc" },
      take:  pagination.limit,
      skip:  pagination.offset,
    }),
    db.schedule.count({ where: { organizationId: orgId } }),
  ])
  return {
    data: schedules.map(serSchedule),
    meta: { total, limit: pagination.limit, offset: pagination.offset },
  }
}

export async function getOrCreateSchedule(
  orgId: string,
  weekStart: string,
): Promise<{ schedule: Schedule; created: boolean }> {
  const weekStartDate = new Date(weekStart + "T00:00:00Z")

  const existing = await db.schedule.findFirst({
    where: { organizationId: orgId, weekStart: weekStartDate },
    include: { shifts: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } },
    orderBy: { createdAt: "asc" },
  })
  if (existing) return { schedule: serSchedule(existing), created: false }

  try {
    const schedule = await db.schedule.create({
      data: { organizationId: orgId, weekStart: weekStartDate },
      include: { shifts: true },
    })
    return { schedule: serSchedule(schedule), created: true }
  } catch (err) {
    // Concurrent POST won the race — return the existing schedule.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const schedule = await db.schedule.findFirst({
        where: { organizationId: orgId, weekStart: weekStartDate },
        include: { shifts: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } },
        orderBy: { createdAt: "asc" },
      })
      return { schedule: serSchedule(schedule!), created: false }
    }
    throw err
  }
}

export async function getScheduleById(
  orgId: string,
  scheduleId: string,
): Promise<Schedule | null> {
  const schedule = await db.schedule.findFirst({
    where: { id: scheduleId, organizationId: orgId },
    include: {
      shifts: {
        include: { employee: { select: PUBLIC_SHIFT_EMPLOYEE_SELECT } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      },
    },
  })
  return schedule ? serSchedule(schedule) : null
}

export async function duplicateSchedule(
  orgId: string,
  scheduleId: string,
  weekStart: string,
): Promise<Schedule> {
  const source = await db.schedule.findFirst({
    where: { id: scheduleId, organizationId: orgId },
    include: { shifts: true },
  })
  if (!source) throw new ServiceError("Not found", "NOT_FOUND")

  const weekDiff = new Date(weekStart + "T00:00:00Z").getTime() - source.weekStart.getTime()

  const newSchedule = await db.schedule.create({
    data: {
      organizationId: orgId,
      weekStart: new Date(weekStart + "T00:00:00Z"),
      isDuplicate: true,
      sourceScheduleId: scheduleId,
    },
  })

  if (source.shifts.length > 0) {
    await db.shift.createMany({
      data: source.shifts.map((shift) => ({
        scheduleId: newSchedule.id,
        organizationId: orgId,
        employeeId: shift.employeeId,
        date: new Date(shift.date.getTime() + weekDiff),
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes,
        jobRole: shift.jobRole,
        notes: shift.notes,
        colorTag: shift.colorTag,
      })),
    })
  }

  void db.schedulingEvent.create({
    data: {
      organizationId: orgId,
      eventType: "SCHEDULE_DUPLICATED",
      payload: { sourceScheduleId: scheduleId, newScheduleId: newSchedule.id, weekStart },
    },
  }).catch((err) => console.error("[SchedulingEvent] Failed to write audit event:", err))

  const result = await db.schedule.findUnique({
    where: { id: newSchedule.id },
    include: { shifts: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } },
  })
  return serSchedule(result!)
}

// ── Magic-moment: starter week + copy-previous ─────────────────────────────────

/** Sensible defaults for an auto-generated starter shift. */
export const STARTER_DEFAULTS = {
  startTime: "09:00",
  endTime: "17:00",
  breakMinutes: 30,
  weekdayCount: 5, // Mon–Fri
} as const

function addDaysISO(weekStart: string, days: number): string {
  const d = new Date(weekStart + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split("T")[0]
}

/**
 * Pure: build a default Mon–Fri 09:00–17:00 shift per employee for `weekStart`.
 * Kept side-effect-free so it can be unit-tested without a DB.
 */
export function buildStarterShifts(
  employees: { id: string; jobRole: string }[],
  weekStart: string,
): CreateShiftInput[] {
  const shifts: CreateShiftInput[] = []
  for (const emp of employees) {
    for (let day = 0; day < STARTER_DEFAULTS.weekdayCount; day++) {
      shifts.push({
        employeeId: emp.id,
        date: addDaysISO(weekStart, day),
        startTime: STARTER_DEFAULTS.startTime,
        endTime: STARTER_DEFAULTS.endTime,
        breakMinutes: STARTER_DEFAULTS.breakMinutes,
        jobRole: emp.jobRole,
      })
    }
  }
  return shifts
}

/**
 * Fill an empty week with a default shift for every active employee so a
 * first-time manager sees a complete schedule immediately. Refuses if the week
 * already has shifts (never overwrites real work).
 */
export async function generateStarterWeek(orgId: string, weekStart: string): Promise<Schedule> {
  const { schedule } = await getOrCreateSchedule(orgId, weekStart)

  const [existingCount, employees] = await Promise.all([
    db.shift.count({ where: { scheduleId: schedule.id } }),
    db.employee.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, jobRole: true },
      orderBy: { createdAt: "asc" },
    }),
  ])
  if (existingCount > 0) throw new ServiceError("This week already has shifts", "CONFLICT")
  if (employees.length === 0) throw new ServiceError("Add an employee first", "CONFLICT")

  await db.shift.createMany({
    data: buildStarterShifts(employees, weekStart).map((s) => ({
      scheduleId:     schedule.id,
      organizationId: orgId,
      employeeId:     s.employeeId,
      date:           new Date(s.date + "T00:00:00Z"),
      startTime:      s.startTime,
      endTime:        s.endTime,
      breakMinutes:   s.breakMinutes ?? 0,
      jobRole:        s.jobRole,
    })),
  })

  void db.schedulingEvent.create({
    data: { organizationId: orgId, eventType: "STARTER_WEEK_GENERATED", payload: { scheduleId: schedule.id, weekStart, employeeCount: employees.length } },
  }).catch((err) => console.error("[SchedulingEvent] Failed to write audit event:", err))

  const result = await db.schedule.findUnique({
    where: { id: schedule.id },
    include: { shifts: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } },
  })
  return serSchedule(result!)
}

/**
 * Clone the most recent prior week that has shifts into `weekStart`, shifting
 * each shift's date by the week delta. Only copies shifts for still-active
 * employees and skips sick days. Refuses if the target week already has shifts.
 */
export async function copyPreviousWeek(orgId: string, weekStart: string): Promise<Schedule> {
  const target = new Date(weekStart + "T00:00:00Z")

  const prior = await db.schedule.findFirst({
    where: { organizationId: orgId, weekStart: { lt: target }, shifts: { some: {} } },
    orderBy: { weekStart: "desc" },
    include: { shifts: true },
  })
  if (!prior) throw new ServiceError("No previous week with shifts to copy", "NOT_FOUND")

  const { schedule } = await getOrCreateSchedule(orgId, weekStart)
  const existingCount = await db.shift.count({ where: { scheduleId: schedule.id } })
  if (existingCount > 0) throw new ServiceError("This week already has shifts", "CONFLICT")

  const activeIds = new Set(
    (await db.employee.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true },
    })).map((e) => e.id),
  )

  const weekDiff = target.getTime() - prior.weekStart.getTime()
  const data = prior.shifts
    .filter((s) => activeIds.has(s.employeeId) && s.colorTag !== "sick")
    .map((s) => ({
      scheduleId:     schedule.id,
      organizationId: orgId,
      employeeId:     s.employeeId,
      date:           new Date(s.date.getTime() + weekDiff),
      startTime:      s.startTime,
      endTime:        s.endTime,
      breakMinutes:   s.breakMinutes,
      jobRole:        s.jobRole,
      notes:          s.notes,
      colorTag:       s.colorTag,
    }))
  if (data.length === 0) throw new ServiceError("Nothing to copy from the previous week", "CONFLICT")

  await db.shift.createMany({ data })

  void db.schedulingEvent.create({
    data: { organizationId: orgId, eventType: "WEEK_COPIED", payload: { scheduleId: schedule.id, sourceScheduleId: prior.id, weekStart, shiftCount: data.length } },
  }).catch((err) => console.error("[SchedulingEvent] Failed to write audit event:", err))

  const result = await db.schedule.findUnique({
    where: { id: schedule.id },
    include: { shifts: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } },
  })
  return serSchedule(result!)
}

export async function publishSchedule(
  orgId: string,
  scheduleId: string,
): Promise<Schedule> {
  const schedule = await db.schedule.findFirst({
    where: { id: scheduleId, organizationId: orgId },
    include: {
      shifts: {
        where: { colorTag: { not: "sick" } },
        include: { employee: { select: { id: true, name: true, phone: true } } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      },
      organization: { select: { name: true, settings: true } },
    },
    orderBy: { createdAt: "asc" },
  })
  if (!schedule) throw new ServiceError("Not found", "NOT_FOUND")
  if (schedule.publishedAt) throw new ServiceError("Already published", "CONFLICT")

  const tf = (schedule.organization.settings as { timeFormat?: "12h" | "24h" } | null)?.timeFormat ?? "24h"

  const updated = await db.schedule.update({
    where: { id: scheduleId },
    data: { publishedAt: new Date() },
    include: { shifts: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } },
  })

  const byEmployee = new Map<string, { name: string; phone: string | null; lines: string[] }>()
  for (const shift of schedule.shifts) {
    const emp = shift.employee
    if (!byEmployee.has(emp.id)) {
      byEmployee.set(emp.id, { name: emp.name, phone: emp.phone, lines: [] })
    }
    const day = new Date(shift.date).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })
    byEmployee.get(emp.id)!.lines.push(`${day} ${formatTime(shift.startTime, tf)}–${formatTime(shift.endTime, tf)}`)
  }

  const weekLabel = formatWeekLabel(schedule.weekStart.toISOString().split("T")[0])
  const orgName = schedule.organization.name
  for (const { name, phone, lines } of byEmployee.values()) {
    if (phone) {
      void sendSchedulePublishedSms({ to: phone, employeeName: name.split(" ")[0], orgName, weekLabel, shiftLines: lines })
    }
  }

  return serSchedule(updated)
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export async function listShifts(orgId: string, scheduleId: string): Promise<Shift[]>
export async function listShifts(orgId: string, scheduleId: string, pagination: PaginationParams): Promise<Paginated<Shift>>
export async function listShifts(
  orgId: string,
  scheduleId: string,
  pagination?: PaginationParams,
): Promise<Shift[] | Paginated<Shift>> {
  if (!pagination) {
    const shifts = await db.shift.findMany({
      where: { scheduleId, organizationId: orgId },
      include: { employee: { select: PUBLIC_SHIFT_EMPLOYEE_SELECT } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    })
    return shifts.map(serShift)
  }
  const where = { scheduleId, organizationId: orgId }
  const [shifts, total] = await Promise.all([
    db.shift.findMany({
      where,
      include: { employee: { select: PUBLIC_SHIFT_EMPLOYEE_SELECT } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take:  pagination.limit,
      skip:  pagination.offset,
    }),
    db.shift.count({ where }),
  ])
  return {
    data: shifts.map(serShift),
    meta: { total, limit: pagination.limit, offset: pagination.offset },
  }
}

export type CreateShiftInput = {
  employeeId: string
  date: string
  startTime: string
  endTime: string
  breakMinutes?: number
  jobRole: string
  notes?: string | null
  colorTag?: string | null
}

export async function createShift(
  orgId: string,
  scheduleId: string,
  input: CreateShiftInput,
): Promise<Shift> {
  const { employeeId, date, startTime, endTime, breakMinutes, jobRole, notes, colorTag } = input

  const dateUTC = new Date(date + "T00:00:00Z")
  const [employeeInOrg, existing] = await Promise.all([
    db.employee.findFirst({ where: { id: employeeId, organizationId: orgId }, select: { id: true } }),
    db.shift.findFirst({ where: { organizationId: orgId, employeeId, date: dateUTC }, select: { id: true }, orderBy: { createdAt: "asc" } }),
  ])
  if (!employeeInOrg) throw new ServiceError("Employee not found", "NOT_FOUND")
  if (existing) throw new ServiceError("This employee already has a shift on this date", "CONFLICT")

  const shift = await db.shift.create({
    data: {
      scheduleId,
      organizationId: orgId,
      employeeId,
      date: dateUTC,
      startTime,
      endTime,
      breakMinutes: breakMinutes ?? 0,
      jobRole,
      notes: notes ?? null,
      colorTag: colorTag ?? null,
    },
  })

  // Changing a published schedule returns it to draft so the manager must
  // re-publish (and thereby re-notify staff) before the change is "live".
  await db.schedule.updateMany({
    where: { id: scheduleId, organizationId: orgId, publishedAt: { not: null } },
    data: { publishedAt: null },
  })

  void db.schedulingEvent.create({
    data: {
      organizationId: orgId,
      eventType: "SHIFT_CREATED",
      payload: { shiftId: shift.id, scheduleId, employeeId, date, jobRole },
    },
  }).catch((err) => console.error("[SchedulingEvent] Failed to write audit event:", err))

  return serShift(shift)
}

export type UpdateShiftInput = {
  employeeId?: string
  date?: string
  startTime?: string
  endTime?: string
  breakMinutes?: number
  jobRole?: string
  notes?: string | null
  colorTag?: string | null
}

export async function updateShift(
  orgId: string,
  scheduleId: string,
  shiftId: string,
  input: UpdateShiftInput,
): Promise<Shift> {
  const existing = await db.shift.findFirst({
    where: { id: shiftId, scheduleId, organizationId: orgId },
    include: {
      employee: { select: { name: true, phone: true } },
      organization: { select: { name: true } },
      schedule: { select: { publishedAt: true } },
    },
  })
  if (!existing) throw new ServiceError("Not found", "NOT_FOUND")

  if (input.employeeId !== undefined) {
    const emp = await db.employee.findFirst({
      where: { id: input.employeeId, organizationId: orgId },
      select: { id: true },
    })
    if (!emp) throw new ServiceError("Employee not found", "NOT_FOUND")
  }

  const shift = await db.shift.update({
    where: { id: shiftId },
    data: {
      ...(input.employeeId  !== undefined && { employeeId: input.employeeId }),
      ...(input.date        !== undefined && { date: new Date(input.date + "T00:00:00Z") }),
      ...(input.startTime   !== undefined && { startTime: input.startTime }),
      ...(input.endTime     !== undefined && { endTime: input.endTime }),
      ...(input.breakMinutes !== undefined && { breakMinutes: input.breakMinutes }),
      ...(input.jobRole     !== undefined && { jobRole: input.jobRole }),
      ...(input.notes       !== undefined && { notes: input.notes }),
      ...(input.colorTag    !== undefined && { colorTag: input.colorTag }),
    },
  })

  // Changing a published schedule returns it to draft so the manager must
  // re-publish (and thereby re-notify staff) before the change is "live".
  // When that happens we skip the per-shift SMS below — the re-publish blast
  // covers it, so we don't double-text the employee.
  const wasPublished = existing.schedule.publishedAt !== null
  if (wasPublished) {
    await db.schedule.update({
      where: { id: scheduleId },
      data: { publishedAt: null },
    })
  }

  const newDate      = input.date      ?? existing.date.toISOString().split("T")[0]
  const newStartTime = input.startTime ?? existing.startTime
  const newEndTime   = input.endTime   ?? existing.endTime
  const orgName      = existing.organization.name
  const oldDate      = existing.date.toISOString().split("T")[0]

  const employeeChanged = input.employeeId !== undefined && input.employeeId !== existing.employeeId
  const timingChanged   = input.date !== undefined || input.startTime !== undefined || input.endTime !== undefined

  if (wasPublished) {
    // Notifications are deferred to re-publish; emit nothing here.
  } else if (employeeChanged) {
    if (existing.employee.phone) {
      void sendShiftCancelledSms({
        to: existing.employee.phone,
        employeeName: existing.employee.name,
        orgName,
        date: oldDate,
        startTime: existing.startTime,
        endTime: existing.endTime,
      })
    }
    if (input.employeeId) {
      const newEmp = await db.employee.findUnique({
        where: { id: input.employeeId },
        select: { name: true, phone: true },
      })
      if (newEmp?.phone) {
        void sendShiftAssignedSms({
          to: newEmp.phone,
          employeeName: newEmp.name,
          orgName,
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
        })
      }
    }
  } else if (timingChanged && existing.employee.phone) {
    void sendShiftUpdatedSms({
      to: existing.employee.phone,
      employeeName: existing.employee.name,
      orgName,
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
    })
  }

  return serShift(shift)
}

export async function deleteShift(
  orgId: string,
  scheduleId: string,
  shiftId: string,
): Promise<void> {
  const existing = await db.shift.findFirst({
    where: { id: shiftId, scheduleId, organizationId: orgId },
    include: {
      employee: { select: { name: true, phone: true } },
      organization: { select: { name: true } },
      schedule: { select: { publishedAt: true } },
    },
  })
  if (!existing) throw new ServiceError("Not found", "NOT_FOUND")

  await db.shift.delete({ where: { id: shiftId } })

  // Changing a published schedule returns it to draft so the manager must
  // re-publish before the change is "live". The re-publish blast covers the
  // notification, so we skip the per-shift cancellation SMS in that case.
  const wasPublished = existing.schedule.publishedAt !== null
  if (wasPublished) {
    await db.schedule.update({
      where: { id: scheduleId },
      data: { publishedAt: null },
    })
  }

  if (!wasPublished && existing.employee.phone) {
    void sendShiftCancelledSms({
      to: existing.employee.phone,
      employeeName: existing.employee.name,
      orgName: existing.organization.name,
      date: existing.date.toISOString().split("T")[0],
      startTime: existing.startTime,
      endTime: existing.endTime,
    })
  }
}

// ── Labor costs ───────────────────────────────────────────────────────────────

export async function getLaborCosts(orgId: string, weekStart: string): Promise<WeeklyLaborCost> {
  const schedule = await db.schedule.findFirst({
    where: { organizationId: orgId, weekStart: new Date(weekStart + "T00:00:00Z") },
    include: {
      shifts: {
        where: { colorTag: { not: "sick" } },
        include: { employee: { select: SHIFT_EMPLOYEE_SELECT } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      },
    },
    orderBy: { createdAt: "asc" },
  })

  const shifts = schedule?.shifts ?? []
  const employeeMap = new Map<string, LaborCostEntry>()

  for (const shift of shifts) {
    const hours = calcHours(shift.startTime, shift.endTime, shift.breakMinutes)
    const emp   = serEmployee(shift.employee)
    if (!employeeMap.has(shift.employeeId)) {
      employeeMap.set(shift.employeeId, { employee: emp, totalHours: 0, totalCost: 0, shifts: [] })
    }
    const entry = employeeMap.get(shift.employeeId)!
    entry.totalHours = Math.round((entry.totalHours + hours) * 100) / 100
    entry.totalCost  = Math.round((entry.totalCost + hours * emp.hourlyWage) * 100) / 100
    entry.shifts.push(serShift(shift))
  }

  const entries = Array.from(employeeMap.values())
  return {
    weekStart,
    totalHours: Math.round(entries.reduce((s, e) => s + e.totalHours, 0) * 100) / 100,
    totalCost:  Math.round(entries.reduce((s, e) => s + e.totalCost,  0) * 100) / 100,
    entries,
  }
}

export async function getLaborCostsCsv(orgId: string, weekStart: string): Promise<string> {
  const [result, org] = await Promise.all([
    getLaborCosts(orgId, weekStart),
    db.organization.findUnique({ where: { id: orgId }, select: { currency: true } }),
  ])
  const currency = org?.currency ?? "EUR"
  const q = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`
  const rows = [
    ["Employee", "Job Role", "Employment Type", "Contracted Hours", "Scheduled Hours", "Days Worked", `Hourly Wage (${currency})`, `Total Pay (${currency})`],
    ...result.entries.map((e) => [
      e.employee.name,
      e.employee.jobRole,
      e.employee.employmentType,
      e.employee.contractedHours,
      e.totalHours,
      new Set(e.shifts.map((s) => s.date)).size,
      e.employee.hourlyWage,
      e.totalCost,
    ]),
  ]
  return rows.map((r) => r.map(q).join(",")).join("\n")
}
