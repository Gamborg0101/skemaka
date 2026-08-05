import { db } from "@/lib/prisma"
import { serSchedule, serShift, serEmployee } from "@/lib/serialize"
import { Prisma } from "@/app/generated/prisma/client"
import {
  sendSchedulePublishedSms,
  sendRollOutSms,
  sendShiftAssignedSms,
  sendShiftCancelledSms,
  sendShiftUpdatedSms,
} from "@/lib/sms"
import { formatWeekLabel, formatTime, calcHours } from "@/lib/dateUtils"
import { sendShiftAssignedEmail, sendShiftCancelledEmail, sendShiftsRolledOutEmail } from "@/lib/resend"
import { sendPushToUsers } from "@/lib/push"
import { getMessageTranslator, recipientLocaleTag, resolveRecipientLocale } from "@/lib/messages"
import type { Locale } from "@skemaka/i18n"
import type { Schedule, Shift, WeeklyLaborCost, LaborCostEntry } from "@/types"
import type { PaginationParams, Paginated } from "@/lib/validate"
import { ServiceError } from "./errors"
import { NOT_SICK } from "./shiftFilters"

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
  opts: {
    /** Hide draft (unsent) shifts — used for non-manager callers, so private
     *  placeholder planning never leaks to employees (web portal or mobile). */
    publishedOnly?: boolean
  } = {},
): Promise<Schedule | null> {
  const weekStartDate = new Date(weekStart + "T00:00:00Z")
  const weekEndDate   = new Date(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [schedule, timeEntries] = await Promise.all([
    db.schedule.findFirst({
      where: { organizationId: orgId, weekStart: weekStartDate },
      include: {
        shifts: {
          ...(opts.publishedOnly ? { where: { publishedAt: { not: null } } } : {}),
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        },
      },
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
    .filter((s) => activeIds.has(s.employeeId) && s.colorTag !== "sick" && !s.cancelledAt)
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

export interface PublishResult {
  schedule: Schedule
  /** How many distinct employees with shifts were notified (email + any SMS). */
  notified: number
}

export async function publishSchedule(
  orgId: string,
  scheduleId: string,
): Promise<PublishResult> {
  // Per-shift publishing: only draft shifts (publishedAt null) are being sent;
  // already-rolled-out shifts were announced when they went out.
  const schedule = await db.schedule.findFirst({
    where: { id: scheduleId, organizationId: orgId },
    include: {
      shifts: {
        where: { ...NOT_SICK, cancelledAt: null, publishedAt: null },
        include: { employee: { select: { id: true, name: true, phone: true, email: true, userId: true, locale: true } } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      },
      organization: { select: { name: true, settings: true, locale: true } },
    },
    orderBy: { createdAt: "asc" },
  })
  if (!schedule) throw new ServiceError("Not found", "NOT_FOUND")
  if (schedule.shifts.length === 0) throw new ServiceError("Nothing to roll out — no draft shifts this week", "CONFLICT")

  const tf = (schedule.organization.settings as { timeFormat?: "12h" | "24h" } | null)?.timeFormat ?? "24h"

  const now = new Date()
  await db.shift.updateMany({
    where: { id: { in: schedule.shifts.map((s) => s.id) } },
    data: { publishedAt: now },
  })
  // Schedule.publishedAt is kept as an informational "last rolled out at" for
  // the week badge — it is never cleared by edits anymore.
  const updated = await db.schedule.update({
    where: { id: scheduleId },
    data: { publishedAt: now },
    include: { shifts: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } },
  })

  const orgLocale = schedule.organization.locale
  const byEmployee = new Map<string, { name: string; phone: string | null; email: string | null; userId: string | null; locale: Locale; lines: string[] }>()
  for (const shift of schedule.shifts) {
    const emp = shift.employee
    if (!byEmployee.has(emp.id)) {
      byEmployee.set(emp.id, {
        name: emp.name, phone: emp.phone, email: emp.email, userId: emp.userId,
        locale: resolveRecipientLocale(emp.locale, orgLocale), lines: [],
      })
    }
    const entry = byEmployee.get(emp.id)!
    const day = new Date(shift.date).toLocaleDateString(recipientLocaleTag(entry.locale), { weekday: "short", timeZone: "UTC" })
    entry.lines.push(`${day} ${formatTime(shift.startTime, tf)}–${formatTime(shift.endTime, tf)}`)
  }

  const weekStartStr = schedule.weekStart.toISOString().split("T")[0]
  const orgName = schedule.organization.name
  // Notify everyone who got a shift: email always (reliable), SMS when a phone
  // is on file and Twilio is configured. Fire-and-forget so a slow/failed send
  // never blocks the roll-out.
  for (const { name, phone, email, lines, locale } of byEmployee.values()) {
    const weekLabel = formatWeekLabel(weekStartStr, recipientLocaleTag(locale))
    if (email) {
      void sendShiftsRolledOutEmail({ to: email, name: name.split(" ")[0], orgName, periodLabel: weekLabel, locale }).catch(() => {})
    }
    if (phone) {
      void sendSchedulePublishedSms({ to: phone, employeeName: name.split(" ")[0], orgName, weekLabel, shiftLines: lines, locale })
    }
  }
  // Push payloads are rendered per language, so group recipients by locale.
  const pushByLocale = new Map<Locale, string[]>()
  for (const { userId, locale } of byEmployee.values()) {
    if (!userId) continue
    if (!pushByLocale.has(locale)) pushByLocale.set(locale, [])
    pushByLocale.get(locale)!.push(userId)
  }
  for (const [locale, userIds] of pushByLocale) {
    const t = getMessageTranslator(locale, "sms")
    const weekLabel = formatWeekLabel(weekStartStr, recipientLocaleTag(locale))
    void sendPushToUsers(userIds, {
      title: t("push.publishedTitle"),
      body: t("push.publishedBody", { orgName, week: weekLabel }),
      url: "/portal",
    })
  }

  return { schedule: serSchedule(updated), notified: byEmployee.size }
}

// ── Multi-week roll-out ─────────────────────────────────────────────────────

export interface PendingRolloutWeek {
  weekStart: string        // YYYY-MM-DD (Monday)
  shiftCount: number
  employeeIds: string[]    // distinct employees with a draft shift that week
  employeeNames: string[]  // matching distinct names, for the review list
}

/** Weeks with at least one draft (unsent) shift, oldest first. */
export async function getPendingRollout(orgId: string): Promise<PendingRolloutWeek[]> {
  const drafts = await db.shift.findMany({
    where: { organizationId: orgId, publishedAt: null, cancelledAt: null, ...NOT_SICK },
    select: {
      employeeId: true,
      employee: { select: { name: true } },
      schedule: { select: { weekStart: true } },
    },
  })

  const byWeek = new Map<string, { count: number; employees: Map<string, string> }>()
  for (const d of drafts) {
    const week = d.schedule.weekStart.toISOString().split("T")[0]
    if (!byWeek.has(week)) byWeek.set(week, { count: 0, employees: new Map() })
    const entry = byWeek.get(week)!
    entry.count++
    entry.employees.set(d.employeeId, d.employee.name)
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, { count, employees }]) => ({
      weekStart,
      shiftCount: count,
      employeeIds: [...employees.keys()],
      employeeNames: [...employees.values()],
    }))
}

export interface RollOutResult {
  weeks: number
  notified: number
  periodLabel: string
}

/**
 * Roll out every draft (unsent) shift within [fromWeek, toWeek] (inclusive,
 * Monday YYYY-MM-DD). Publishes them all in one shot and notifies each affected
 * employee ONCE (email always; SMS when a number is on file) that the roll-out
 * for the whole period is ready. Already-rolled-out shifts are untouched — no
 * one is re-notified about shifts they already know about.
 */
export async function rollOut(
  orgId: string,
  fromWeek: string,
  toWeek: string,
): Promise<RollOutResult> {
  // Match by the same normalized week key getPendingRollout returns (the
  // Prisma-stored weekStart has mixed time components across legacy rows, so a
  // raw DateTime range is unreliable; YYYY-MM-DD string compare is exact).
  const weekKey = (d: Date) => d.toISOString().split("T")[0]

  const drafts = await db.shift.findMany({
    where: { organizationId: orgId, publishedAt: null, cancelledAt: null, ...NOT_SICK },
    include: {
      employee: { select: { id: true, name: true, phone: true, email: true, userId: true, locale: true } },
      schedule: { select: { id: true, weekStart: true } },
    },
  })

  const toPublish = drafts.filter((s) => {
    const k = weekKey(s.schedule.weekStart)
    return k >= fromWeek && k <= toWeek
  })
  if (toPublish.length === 0) {
    throw new ServiceError("No draft shifts to roll out", "CONFLICT")
  }

  const now = new Date()
  await db.shift.updateMany({
    where: { id: { in: toPublish.map((s) => s.id) } },
    data: { publishedAt: now },
  })
  // Stamp the informational week badge on every affected schedule.
  await db.schedule.updateMany({
    where: { id: { in: [...new Set(toPublish.map((s) => s.schedule.id))] } },
    data: { publishedAt: now },
  })

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true, locale: true } })
  const orgName = org?.name ?? ""

  // One notification per employee across the whole period — only people who
  // actually got newly published shifts.
  const byEmployee = new Map<string, { name: string; phone: string | null; email: string | null; userId: string | null; locale: Locale }>()
  for (const shift of toPublish) {
    const e = shift.employee
    if (!byEmployee.has(e.id)) {
      byEmployee.set(e.id, {
        name: e.name, phone: e.phone, email: e.email, userId: e.userId,
        locale: resolveRecipientLocale(e.locale, org?.locale),
      })
    }
  }

  // Period spans the first rolled week's Monday to the last rolled week's Sunday.
  const publishedWeeks = [...new Set(toPublish.map((s) => weekKey(s.schedule.weekStart)))].sort()
  const firstMonday = new Date(publishedWeeks[0] + "T00:00:00Z")
  const lastMonday  = new Date(publishedWeeks[publishedWeeks.length - 1] + "T00:00:00Z")
  const lastSunday  = new Date(lastMonday.getTime() + 6 * 24 * 60 * 60 * 1000)
  const periodFor = (locale: Locale) => {
    const tag = recipientLocaleTag(locale)
    const fmt = (d: Date) => d.toLocaleDateString(tag, { day: "numeric", month: "short", timeZone: "UTC" })
    return publishedWeeks.length === 1
      ? formatWeekLabel(publishedWeeks[0], tag)
      : `${fmt(firstMonday)} – ${fmt(lastSunday)}`
  }
  // English label returned to the manager UI (kept as before).
  const periodLabel = periodFor("en")

  for (const { name, phone, email, locale } of byEmployee.values()) {
    const first = name.split(" ")[0]
    const period = periodFor(locale)
    if (email) void sendShiftsRolledOutEmail({ to: email, name: first, orgName, periodLabel: period, locale }).catch(() => {})
    if (phone) void sendRollOutSms({ to: phone, employeeName: first, orgName, periodLabel: period, locale })
  }
  // Push payloads are rendered per language, so group recipients by locale.
  const pushByLocale = new Map<Locale, string[]>()
  for (const { userId, locale } of byEmployee.values()) {
    if (!userId) continue
    if (!pushByLocale.has(locale)) pushByLocale.set(locale, [])
    pushByLocale.get(locale)!.push(userId)
  }
  for (const [locale, userIds] of pushByLocale) {
    const t = getMessageTranslator(locale, "sms")
    void sendPushToUsers(userIds, {
      title: t("push.rollOutTitle"),
      body: t("push.rollOutBody", { orgName, period: periodFor(locale) }),
      url: "/portal",
    })
  }

  return { weeks: publishedWeeks.length, notified: byEmployee.size, periodLabel }
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
  /** Publish this shift immediately and notify the employee now, instead of
   *  leaving it as a private draft to be committed by the next roll-out. */
  notifyNow?: boolean
}

export async function createShift(
  orgId: string,
  scheduleId: string,
  input: CreateShiftInput,
): Promise<Shift> {
  const { employeeId, date, startTime, endTime, breakMinutes, jobRole, notes, colorTag, notifyNow } = input

  const dateUTC = new Date(date + "T00:00:00Z")
  const [employeeInOrg, existing] = await Promise.all([
    db.employee.findFirst({
      where: { id: employeeId, organizationId: orgId },
      select: { id: true, name: true, email: true, phone: true, locale: true, organization: { select: { name: true, locale: true } } },
    }),
    db.shift.findFirst({ where: { organizationId: orgId, employeeId, date: dateUTC, cancelledAt: null }, select: { id: true }, orderBy: { createdAt: "asc" } }),
  ])
  if (!employeeInOrg) throw new ServiceError("Employee not found", "NOT_FOUND")
  if (existing) {
    throw new ServiceError("This employee already has a shift on this date", "CONFLICT", {
      messageKey: "shiftConflict",
    })
  }

  // Sick days are records of an absence, not plans — they are born published
  // (no roll-out needed) and never notified (the person knows they're sick).
  const isSick = colorTag === "sick"

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
      // Draft by default: a private placeholder committed by Roll out.
      publishedAt: isSick || notifyNow ? new Date() : null,
    },
  })

  void db.schedulingEvent.create({
    data: {
      organizationId: orgId,
      eventType: "SHIFT_CREATED",
      payload: { shiftId: shift.id, scheduleId, employeeId, date, jobRole },
    },
  }).catch((err) => console.error("[SchedulingEvent] Failed to write audit event:", err))

  // "Notify now": the ad-hoc case (e.g. someone coming in on their day off,
  // today) — send the shift straight to the employee instead of waiting for
  // roll-out. Fire-and-forget; never block or fail the create on a send error.
  if (notifyNow && !isSick) {
    const empLocale = resolveRecipientLocale(employeeInOrg.locale, employeeInOrg.organization.locale)
    const orgName = employeeInOrg.organization.name
    if (employeeInOrg.email) {
      const dateLabel = new Date(date + "T12:00:00Z").toLocaleDateString(recipientLocaleTag(empLocale), {
        weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
      })
      void sendShiftAssignedEmail({
        to: employeeInOrg.email,
        name: employeeInOrg.name,
        orgName,
        dateLabel,
        startTime,
        endTime,
        jobRole,
        locale: empLocale,
      }).catch((err) => console.error("[ShiftEmail] Failed to send shift-assigned email:", err))
    }
    if (employeeInOrg.phone) {
      void sendShiftAssignedSms({
        to: employeeInOrg.phone,
        employeeName: employeeInOrg.name,
        orgName,
        date,
        startTime,
        endTime,
        locale: empLocale,
      })
    }
  }

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
      employee: { select: { name: true, phone: true, locale: true } },
      organization: { select: { name: true, locale: true } },
    },
  })
  if (!existing) throw new ServiceError("Not found", "NOT_FOUND")
  if (existing.cancelledAt) throw new ServiceError("Cancelled shifts cannot be edited", "CONFLICT")

  if (input.employeeId !== undefined) {
    const emp = await db.employee.findFirst({
      where: { id: input.employeeId, organizationId: orgId },
      select: { id: true },
    })
    if (!emp) throw new ServiceError("Employee not found", "NOT_FOUND")
  }

  // One shift per employee per date — the same block createShift enforces. A
  // move/reassign must not land on a day the target employee already works, so
  // re-check whenever the employee or date changes (excluding this shift itself).
  const employeeChanges = input.employeeId !== undefined && input.employeeId !== existing.employeeId
  const dateChanges     = input.date !== undefined && input.date !== existing.date.toISOString().split("T")[0]
  if (employeeChanges || dateChanges) {
    const clash = await db.shift.findFirst({
      where: {
        organizationId: orgId,
        employeeId: input.employeeId ?? existing.employeeId,
        date: input.date ? new Date(input.date + "T00:00:00Z") : existing.date,
        id: { not: shiftId },
        cancelledAt: null,
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
    if (clash) {
      throw new ServiceError("This employee already has a shift on this date", "CONFLICT", {
        messageKey: "shiftConflict",
      })
    }
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

  // Draft shifts are private placeholders — editing one is silent. Editing an
  // already-rolled-out shift is live news for the person on it, so they (and,
  // on reassignment, the new person) are notified immediately. The shift stays
  // published: "new = draft until roll-out; touching something sent = they
  // hear now."
  const wasPublished = existing.publishedAt !== null

  const newDate      = input.date      ?? existing.date.toISOString().split("T")[0]
  const newStartTime = input.startTime ?? existing.startTime
  const newEndTime   = input.endTime   ?? existing.endTime
  const orgName      = existing.organization.name
  const oldDate      = existing.date.toISOString().split("T")[0]

  const employeeChanged = input.employeeId !== undefined && input.employeeId !== existing.employeeId
  const timingChanged   = input.date !== undefined || input.startTime !== undefined || input.endTime !== undefined

  const existingLocale = resolveRecipientLocale(existing.employee.locale, existing.organization.locale)
  if (!wasPublished) {
    // Draft: nobody has seen this shift — nothing to announce.
  } else if (employeeChanged) {
    if (existing.employee.phone) {
      void sendShiftCancelledSms({
        to: existing.employee.phone,
        employeeName: existing.employee.name,
        orgName,
        date: oldDate,
        startTime: existing.startTime,
        endTime: existing.endTime,
        locale: existingLocale,
      })
    }
    if (input.employeeId) {
      const newEmp = await db.employee.findUnique({
        where: { id: input.employeeId },
        select: { name: true, phone: true, locale: true },
      })
      if (newEmp?.phone) {
        void sendShiftAssignedSms({
          to: newEmp.phone,
          employeeName: newEmp.name,
          orgName,
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
          locale: resolveRecipientLocale(newEmp.locale, existing.organization.locale),
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
      locale: existingLocale,
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
      employee: { select: { name: true, phone: true, locale: true } },
      organization: { select: { name: true, locale: true } },
    },
  })
  if (!existing) throw new ServiceError("Not found", "NOT_FOUND")

  await db.shift.delete({ where: { id: shiftId } })

  // Deleting a draft is silent (nobody ever saw it). Deleting a rolled-out
  // shift is live news for the person on it — tell them immediately. A shift
  // that was already cancelled was already announced as cancelled, so deleting
  // the leftover record must not text the employee a second time.
  const wasPublished = existing.publishedAt !== null
  if (wasPublished && !existing.cancelledAt && existing.employee.phone) {
    void sendShiftCancelledSms({
      to: existing.employee.phone,
      employeeName: existing.employee.name,
      orgName: existing.organization.name,
      date: existing.date.toISOString().split("T")[0],
      startTime: existing.startTime,
      endTime: existing.endTime,
      locale: resolveRecipientLocale(existing.employee.locale, existing.organization.locale),
    })
  }
}

/**
 * Cancel a shift: the row is kept as a visible record (struck-through in the
 * manager grid and the employee portal) and the affected employee is notified
 * immediately (SMS + email + push). Unlike edit/delete, cancelling never
 * reverts a published week to draft — the rest of the schedule stands, so no
 * re-publish blast is needed.
 */
export async function cancelShift(
  orgId: string,
  scheduleId: string,
  shiftId: string,
): Promise<Shift> {
  const existing = await db.shift.findFirst({
    where: { id: shiftId, scheduleId, organizationId: orgId },
    include: {
      employee: { select: { name: true, phone: true, email: true, userId: true, locale: true } },
      organization: { select: { name: true, locale: true } },
    },
  })
  if (!existing) throw new ServiceError("Not found", "NOT_FOUND")
  if (existing.cancelledAt) throw new ServiceError("Shift is already cancelled", "CONFLICT")
  if (existing.colorTag === "sick") throw new ServiceError("Sick days cannot be cancelled — delete them instead", "CONFLICT")
  // A draft was never sent, so there is nothing to cancel — just delete it.
  if (!existing.publishedAt) throw new ServiceError("Draft shifts cannot be cancelled — delete them instead", "BAD_REQUEST")

  // Compare-and-swap on `cancelledAt: null`. The read above cannot enforce
  // once-only: a double-click sends two cancels, both see an uncancelled shift,
  // and both proceed — so the employee gets two "your shift is cancelled" texts
  // and the audit log gets two SHIFT_CANCELLED events for one shift.
  const swap = await db.shift.updateMany({
    where: { id: shiftId, organizationId: orgId, cancelledAt: null },
    data: { cancelledAt: new Date() },
  })
  if (swap.count === 0) {
    throw new ServiceError("Shift is already cancelled", "CONFLICT")
  }

  const shift = await db.shift.findUniqueOrThrow({ where: { id: shiftId } })

  void db.schedulingEvent.create({
    data: {
      organizationId: orgId,
      eventType: "SHIFT_CANCELLED",
      payload: { shiftId, scheduleId, employeeId: existing.employeeId, date: existing.date.toISOString().split("T")[0] },
    },
  }).catch((err) => console.error("[SchedulingEvent] Failed to write audit event:", err))

  const locale  = resolveRecipientLocale(existing.employee.locale, existing.organization.locale)
  const date    = existing.date.toISOString().split("T")[0]
  const orgName = existing.organization.name
  const firstName = existing.employee.name.split(" ")[0]

  if (existing.employee.phone) {
    void sendShiftCancelledSms({
      to: existing.employee.phone,
      employeeName: firstName,
      orgName,
      date,
      startTime: existing.startTime,
      endTime: existing.endTime,
      locale,
    })
  }
  if (existing.employee.email) {
    const dateLabel = new Date(date + "T12:00:00Z").toLocaleDateString(recipientLocaleTag(locale), {
      weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
    })
    void sendShiftCancelledEmail({
      to: existing.employee.email,
      name: firstName,
      orgName,
      dateLabel,
      startTime: existing.startTime,
      endTime: existing.endTime,
      jobRole: existing.jobRole,
      locale,
    }).catch((err) => console.error("[ShiftEmail] Failed to send shift-cancelled email:", err))
  }
  if (existing.employee.userId) {
    const t = getMessageTranslator(locale, "sms")
    const dayLabel = new Date(date + "T12:00:00Z").toLocaleDateString(recipientLocaleTag(locale), {
      weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
    })
    void sendPushToUsers([existing.employee.userId], {
      title: t("push.shiftCancelledTitle"),
      body: t("push.shiftCancelledBody", { orgName, when: dayLabel }),
      url: "/portal",
    })
  }

  return serShift(shift)
}

// ── Labor costs ───────────────────────────────────────────────────────────────

export async function getLaborCosts(orgId: string, weekStart: string): Promise<WeeklyLaborCost> {
  const schedule = await db.schedule.findFirst({
    where: { organizationId: orgId, weekStart: new Date(weekStart + "T00:00:00Z") },
    include: {
      shifts: {
        where: { ...NOT_SICK, cancelledAt: null },
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
