/**
 * Pure planner for the demo sandbox.
 *
 * Produces the ENTIRE sandbox as plain data so lib/demo/demoInvariants.ts can
 * prove it coherent *before* a single row is written. Mirrors the existing
 * buildStarterShifts/generateStarterWeek split: compute here, write in
 * lib/demo/seedDemoOrg.ts.
 *
 * Three rules this file exists to enforce, all of which were violated by the
 * previous inline generator and shipped to every visitor:
 *
 *  1. **Every employee works every week.** The old rotation hashed with a
 *     multiplier congruent to 12 (mod 97); since 12 is divisible by every pool
 *     size (4, 3, 2) the rotation collapsed to "always start at index 0" and
 *     one employee was never scheduled at all — a name in the roster with a
 *     permanently blank row. Replaced by an explicit round-robin cursor that
 *     advances by the day's headcount, so a pool is exhausted in
 *     ceil(pool / count) days by construction.
 *
 *  2. **The venue is open seven days a week.** The UI opens on the real
 *     calendar date, so *any* closed day is a 1-in-7 chance of landing a
 *     visitor on an empty screen. There is no closed day that is safe. Monday
 *     and Tuesday are staffed lightly instead — quiet-day realism without a
 *     dead screen. (Closed days remain discoverable in Settings, which is where
 *     a prospect would evaluate them anyway.)
 *
 *  3. **Garnishes are derived from the plan, never guessed at.** Time off,
 *     "can't work" availability, the cover request and the shift offer are all
 *     chosen from gaps in the *actual* planned roster. The old code hardcoded
 *     day offsets and produced a person who was simultaneously on approved
 *     leave and rostered, and an offer whose accepted candidate was already
 *     working that exact slot.
 *
 * Dates are YYYY-MM-DD strings throughout, computed with the LOCAL date helpers
 * in lib/dateUtils.ts — the same ones the schedule UI uses. (The old planner
 * derived its weeks in UTC while the UI derived them locally, so a visitor east
 * of Greenwich could land on a week the seed considered the past.) The writer
 * converts to UTC-midnight Dates at the boundary.
 */

import { addDays, calcHours, getMondayOfWeek } from "@/lib/dateUtils"
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo/constants"

export type DemoLocale = "en" | "da"

/** 0 = Mon … 6 = Sun — the same convention as OrgSettings.hours. */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface PlannedShift {
  id: string
  scheduleId: string
  employeeId: string
  date: string
  startTime: string
  endTime: string
  breakMinutes: number
  jobRole: string
  colorTag: string | null
  notes: string | null
  publishedAt: Date | null
  cancelledAt: Date | null
}

export interface PlannedEmployee {
  id: string
  name: string
  email: string
  jobRole: string
  hourlyWage: number
  contractedHours: number
  employmentType: "FULL_TIME" | "PART_TIME"
  /**
   * The visitor's own record. Seeded with `userId` pointing at the manager
   * account, which is what makes the employee half of the product work in a
   * sandbox: cover, shift offers and availability all resolve the caller's own
   * employee row, and a manager who wasn't on the roster had none.
   */
  isManager?: boolean
}

export interface PlannedSchedule {
  id: string
  weekIdx: number
  weekStart: string
  publishedAt: Date | null
}

export interface PlannedTimeEntry {
  employeeId: string
  shiftId: string
  clockIn: Date
  clockOut: Date
  breakMinutes: number
}

/** A type alias, not an interface — Prisma's InputJsonValue only accepts types
 *  with an implicit index signature, which interfaces do not get. */
export type OpeningHours = {
  isOpen: boolean
  openTime: string
  closeTime: string
}

export interface DemoPlan {
  locale: DemoLocale
  now: Date
  monday0: string
  org: {
    name: string
    slug: string
    seats: number
    currency: string
    country: string
    locale: DemoLocale
    settings: {
      hours: OpeningHours[]
      defaultScheduleView: "week" | "timeline"
      timeOffEnabled: boolean
      timeFormat: "12h" | "24h"
    }
  }
  manager: { name: string; email: string }
  jobRoles: { name: string; color: string }[]
  shiftTemplates: {
    name: string
    startTime: string
    endTime: string
    breakMinutes: number
    jobRole: string
    colorTag: string
    sortOrder: number
  }[]
  employees: PlannedEmployee[]
  schedules: PlannedSchedule[]
  shifts: PlannedShift[]
  timeEntries: PlannedTimeEntry[]
  availability: {
    weekStart: string
    deadline: Date
    submissions: {
      employeeId: string
      days: { date: string; isAvailable: boolean; startTime: string | null; endTime: string | null }[]
    }[]
  }
  timeOff: {
    employeeId: string
    startDate: string
    endDate: string
    reason: string
    status: "APPROVED" | "PENDING"
  }[]
  /** Non-optional on purpose: a `find()` that returns undefined must be a type
   *  error, not a silent skip that leaves the landing screen's panel empty. */
  coverRequest: { shiftId: string; requesterEmployeeId: string; note: string }
  shiftOffer: {
    date: string
    startTime: string
    endTime: string
    jobRole: string
    breakMinutes: number
    note: string
    deadline: Date
    recipients: { employeeId: string; response: "ACCEPTED" | "PENDING" }[]
  }
  /** Where the UI will actually open. Checked by DEMO-030/031. */
  landing: { weekStart: string; day: string; view: "week" | "timeline" }
}

export interface BuildDemoPlanOptions {
  locale: DemoLocale
  /** Injected so tests can pin "today" to every weekday of the year. */
  now?: Date
  /** Injected so tests get stable ids and can diff two plans. */
  newId?: () => string
}

// ── Cast ──────────────────────────────────────────────────────────────────────

/**
 * Job roles are seeded *data*, not UI copy, so next-intl never touches them —
 * which meant a Danish sandbox showed "Kitchen" / "Front of house" / "Bar" on
 * every single shift card, on the flagship screen, surrounded by otherwise
 * fluent Danish. They have to be localized at the point they are created.
 * `roleColor` and the invariants key off these same values, so keep them the
 * single source for a plan's role names.
 */
function rolesFor(locale: DemoLocale) {
  return locale === "da"
    ? { kitchen: "Køkken", foh: "Servering", bar: "Bar" }
    : { kitchen: "Kitchen", foh: "Front of house", bar: "Bar" }
}

/**
 * Index layout: 0–3 Kitchen (0 = head chef), 4–6 Front of house, 7–8 Bar.
 * Index 9 is the manager, appended by buildDemoPlan and rostered front of
 * house — see MANAGER_IDX and the FOH pool below.
 */
interface CastMember {
  name: string
  jobRole: string
  wage: number
}

function cast(locale: DemoLocale): CastMember[] {
  const { kitchen: k, foh: f, bar: b } = rolesFor(locale)
  if (locale === "da") {
    return [
      { name: "Mads Jensen", jobRole: k, wage: 139 },
      { name: "Freja Nielsen", jobRole: k, wage: 116 },
      { name: "Anders Holm", jobRole: k, wage: 105 },
      { name: "Oliver Skov", jobRole: k, wage: 86 },
      { name: "Sofie Larsen", jobRole: f, wage: 94 },
      { name: "Mikkel Andersen", jobRole: f, wage: 90 },
      { name: "Clara Berg", jobRole: f, wage: 90 },
      { name: "Ida Hansen", jobRole: b, wage: 101 },
      { name: "Emil Lund", jobRole: b, wage: 98 },
    ]
  }
  return [
    { name: "James Walker", jobRole: k, wage: 18.5 },
    { name: "Sarah Brooks", jobRole: k, wage: 15.5 },
    { name: "Daniel Foster", jobRole: k, wage: 14 },
    { name: "Oliver Reed", jobRole: k, wage: 11.5 },
    { name: "Emma Clarke", jobRole: f, wage: 12.5 },
    { name: "Tom Hughes", jobRole: f, wage: 12 },
    { name: "Lucy Palmer", jobRole: f, wage: 12 },
    { name: "Olivia Bennett", jobRole: b, wage: 13.5 },
    { name: "Jack Murphy", jobRole: b, wage: 13 },
  ]
}

/**
 * The manager's own slot in the cast, appended after the nine staff.
 *
 * They are rostered like anyone else rather than being a passive owner: the
 * sandbox visitor *is* this person, and a demo where "My shifts" is empty and
 * every cover or offer action answers "you have no employee profile" shows off
 * half a product. Front of house so they're on the floor on busy nights.
 */
const MANAGER_IDX = 9

const KITCHEN = [0, 1, 2, 3]
const FOH = [4, 5, 6, MANAGER_IDX]
const BAR = [7, 8]

/** Weeks seeded either side of the current one. */
export const FIRST_WEEK = -8
export const LAST_WEEK = 7
/** Weeks a visitor can reach in a click or two — held to the strictest checks. */
export const NEARBY_WEEKS = [-2, -1, 0, 1, 2]

/**
 * Headcount per role for each weekday. Mon/Tue run quiet, Fri/Sat busy — the
 * shape of a real bistro week, with nobody's screen ever empty.
 */
const STAFFING: { kitchen: number; foh: number; bar: number }[] = [
  { kitchen: 2, foh: 1, bar: 1 }, // Mon — quiet
  { kitchen: 2, foh: 2, bar: 1 }, // Tue
  { kitchen: 2, foh: 2, bar: 1 }, // Wed
  { kitchen: 2, foh: 2, bar: 1 }, // Thu
  { kitchen: 3, foh: 3, bar: 2 }, // Fri — busy
  { kitchen: 3, foh: 3, bar: 2 }, // Sat — busy
  { kitchen: 2, foh: 2, bar: 1 }, // Sun
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Non-negative modulo — week indices go negative. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

/**
 * Deterministic round-robin. Advancing the cursor by `count` each day means
 * every pool member is scheduled within ceil(pool.length / count) days, so no
 * employee can be systematically skipped (the DEMO-032 guarantee).
 */
function rotate(pool: number[], count: number, cursor: number): number[] {
  return Array.from({ length: Math.min(count, pool.length) }, (_, i) => pool[mod(cursor + i, pool.length)])
}

/** Well-mixed 32-bit hash — used only for cosmetic jitter, never for rotation. */
function hash(n: number): number {
  let x = (n * 2654435761) >>> 0
  x ^= x >>> 15
  x = (x * 2246822519) >>> 0
  x ^= x >>> 13
  return x >>> 0
}

/** 0 = Mon … 6 = Sun for a YYYY-MM-DD string, noon-anchored per dateUtils. */
export function dayIndexOf(iso: string): number {
  return mod(new Date(iso + "T12:00:00").getDay() - 1, 7)
}

interface RawShift {
  employeeIdx: number
  day: number
  startTime: string
  endTime: string
  breakMinutes: number
}

/** One week of shifts, keyed by employee index. Deterministic in `weekIdx`. */
function planWeek(weekIdx: number): RawShift[] {
  const out: RawShift[] = []
  // Cursors start offset by the week so consecutive weeks don't repeat, and
  // advance by that day's headcount so the pool cycles within the week.
  let kCursor = weekIdx * 3
  let fCursor = weekIdx * 2
  let bCursor = weekIdx

  for (let day = 0; day <= 6; day++) {
    const busy = day === 4 || day === 5
    const { kitchen, foh, bar } = STAFFING[day]

    rotate(KITCHEN, kitchen, kCursor).forEach((idx, i) =>
      out.push({
        employeeIdx: idx,
        day,
        startTime: i === 0 ? "14:00" : "15:00",
        endTime: i === 0 ? "22:00" : "23:00",
        breakMinutes: 30,
      }),
    )
    rotate(FOH, foh, fCursor).forEach((idx, i) =>
      out.push({
        employeeIdx: idx,
        day,
        startTime: busy && i === 0 ? "12:00" : "16:00",
        endTime: busy && i === 0 ? "20:00" : "23:00",
        breakMinutes: 30,
      }),
    )
    rotate(BAR, bar, bCursor).forEach((idx) =>
      out.push({ employeeIdx: idx, day, startTime: "16:00", endTime: "23:00", breakMinutes: 0 }),
    )

    kCursor += kitchen
    fCursor += foh
    bCursor += bar
  }
  return out
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function buildDemoPlan({ locale, now = new Date(), newId }: BuildDemoPlanOptions): DemoPlan {
  const nextId = newId ?? (() => crypto.randomUUID())
  const suffix = nextId().slice(0, 8)
  const isDa = locale === "da"
  const ROLES = rolesFor(locale)

  const manager = {
    name: isDa ? "Lars Petersen" : "Michael Carter",
    email: `demo-${suffix}@${DEMO_EMAIL_DOMAIN}`,
  }

  // The manager joins the roster at MANAGER_IDX, so every downstream
  // derivation — shifts, contracted hours, labour cost, seats, coverage — sees
  // them as ordinary staff and stays internally consistent by construction.
  const people: CastMember[] = [
    ...cast(locale),
    { name: manager.name, jobRole: ROLES.foh, wage: isDa ? 152 : 19.5 },
  ]

  const monday0 = getMondayOfWeek(now)

  // Open every day — see rule 2 in the file header.
  const hours: OpeningHours[] = Array.from({ length: 7 }, () => ({
    isOpen: true,
    openTime: "12:00",
    closeTime: "23:00",
  }))

  // Plan every week exactly once. Everything downstream — sick days, time off,
  // availability, the cover request, the offer — is derived from this map, so
  // the garnishes can never contradict the roster.
  const rawByWeek = new Map<number, RawShift[]>()
  for (let w = FIRST_WEEK; w <= LAST_WEEK; w++) rawByWeek.set(w, planWeek(w))

  const employeeIds = people.map(() => nextId())

  /** Net hours employee `idx` is planned for in `weekIdx`. */
  const weekHours = (weekIdx: number, idx: number) =>
    (rawByWeek.get(weekIdx) ?? [])
      .filter((s) => s.employeeIdx === idx)
      .reduce((sum, s) => sum + calcHours(s.startTime, s.endTime, s.breakMinutes), 0)

  /**
   * Contracts are derived from the roster the manager actually built, so the
   * chip badges read "hours met" rather than accusing the demo manager of
   * mis-staffing all nine people. Two deliberate deviations keep the
   * under/over states on screen so the feature still demonstrates itself.
   */
  const contractOffset = (idx: number) => (idx === 3 ? 3 : idx === 6 ? -2 : 0)
  const employees: PlannedEmployee[] = people.map((p, i) => {
    const contracted = Math.round(weekHours(0, i)) + contractOffset(i)
    const isManager = i === MANAGER_IDX
    return {
      id: employeeIds[i],
      name: p.name,
      // The manager's employee row must carry the same address as their user
      // account: that is what links the two, and what the identity lookups
      // fall back to before the record is claimed.
      email: isManager
        ? manager.email
        : `${p.name.toLowerCase().replace(/[^a-z]+/g, ".")}-${suffix}@${DEMO_EMAIL_DOMAIN}`,
      jobRole: p.jobRole,
      hourlyWage: p.wage,
      contractedHours: contracted,
      employmentType: contracted >= 37 ? "FULL_TIME" : "PART_TIME",
      ...(isManager ? { isManager: true } : {}),
    }
  })

  const roleColor = (jobRole: string) =>
    jobRole === ROLES.kitchen ? "orange" : jobRole === ROLES.foh ? "blue" : "purple"

  // ── Schedules + shifts ──────────────────────────────────────────────────────
  const schedules: PlannedSchedule[] = []
  const shifts: PlannedShift[] = []
  const timeEntries: PlannedTimeEntry[] = []
  const scheduleIdByWeek = new Map<number, string>()

  for (let w = FIRST_WEEK; w <= LAST_WEEK; w++) {
    const weekStart = addDays(monday0, w * 7)
    const scheduleId = nextId()
    scheduleIdByWeek.set(w, scheduleId)
    // Up to and including next week is rolled out; +2… stay private drafts so
    // the Roll out flow demos itself.
    const publishedAt = w <= 1 ? new Date(now.getTime() - (2 - w) * 24 * 60 * 60 * 1000) : null
    schedules.push({ id: scheduleId, weekIdx: w, weekStart, publishedAt })

    for (const s of rawByWeek.get(w)!) {
      const date = addDays(weekStart, s.day)
      const id = nextId()
      const person = people[s.employeeIdx]
      shifts.push({
        id,
        scheduleId,
        employeeId: employeeIds[s.employeeIdx],
        date,
        startTime: s.startTime,
        endTime: s.endTime,
        breakMinutes: s.breakMinutes,
        jobRole: person.jobRole,
        colorTag: roleColor(person.jobRole),
        notes: null,
        publishedAt,
        cancelledAt: null,
      })

      // Past weeks: most shifts were clocked, with small deterministic jitter so
      // timesheets and costs look human rather than generated.
      if (w < 0 && hash(w * 31 + s.day * 7 + s.employeeIdx) % 7 !== 0) {
        const jitterIn = (hash(w * 11 + s.employeeIdx) % 3) * 5 - 5 // -5 | 0 | +5 min
        const jitterOut = (hash(w * 3 + s.day) % 4) * 5 // 0 … +15 min
        const clockIn = new Date(new Date(`${date}T${s.startTime}:00Z`).getTime() + jitterIn * 60_000)
        const clockOut = new Date(new Date(`${date}T${s.endTime}:00Z`).getTime() + jitterOut * 60_000)
        // Week boundaries are local (getMondayOfWeek) but clock times are UTC,
        // so for a visitor far enough east the tail of "last week" is still in
        // the future — and you cannot clock out of a shift that hasn't ended.
        // Guarding on the instant rather than the week index keeps this true in
        // every timezone instead of only the ones west of the server.
        if (clockOut < now) {
          timeEntries.push({
            employeeId: employeeIds[s.employeeIdx],
            shiftId: id,
            clockIn,
            clockOut,
            breakMinutes: s.breakMinutes,
          })
        }
      }
    }
  }

  /** Day indices employee `idx` is NOT rostered on in `weekIdx`. */
  const freeDays = (weekIdx: number, idx: number): number[] => {
    const planned = new Set((rawByWeek.get(weekIdx) ?? []).filter((s) => s.employeeIdx === idx).map((s) => s.day))
    return [0, 1, 2, 3, 4, 5, 6].filter((d) => !planned.has(d))
  }

  // A cancelled shift last week, kept as a struck-through record.
  const lastWeekShifts = shifts.filter((s) => s.scheduleId === scheduleIdByWeek.get(-1))
  lastWeekShifts[2].cancelledAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
  // Its time entry has to go too — nobody clocks in for a shift that was cancelled.
  const cancelledId = lastWeekShifts[2].id
  const cancelledEntry = timeEntries.findIndex((t) => t.shiftId === cancelledId)
  if (cancelledEntry !== -1) timeEntries.splice(cancelledEntry, 1)

  // Two sick days in the recent past — always placed on a day that person is
  // genuinely free, so a sick bar can never be painted over a real shift.
  const sickNote = isDa ? "Influenza" : "Flu"
  const sickRole = isDa ? "Sygedag" : "Sick Day"
  for (const [w, empIdx] of [[-2, 1], [-4, 5]] as const) {
    const free = freeDays(w, empIdx)
    if (free.length === 0) continue
    shifts.push({
      id: nextId(),
      scheduleId: scheduleIdByWeek.get(w)!,
      employeeId: employeeIds[empIdx],
      date: addDays(addDays(monday0, w * 7), free[0]),
      startTime: "00:00",
      endTime: "00:00",
      breakMinutes: 0,
      jobRole: sickRole,
      colorTag: "sick",
      notes: sickNote,
      publishedAt: schedules.find((s) => s.weekIdx === w)!.publishedAt,
      cancelledAt: null,
    })
  }

  const nextMonday = addDays(monday0, 7)

  // ── Shift offer — the accepted candidate must actually be free ──────────────
  // Prefer a weekend day (an extra shift reads best on a busy night), but only
  // ever pick a day the accepting employee is genuinely not rostered on, so
  // clicking Confirm cannot double-book them. Resolved BEFORE availability so
  // that day can be reserved as available.
  const offerDay = [5, 6, 4, 3, 2, 1, 0]
    .map((day) => ({ day, free: FOH.filter((idx) => freeDays(1, idx).includes(day)) }))
    .find((c) => c.free.length > 0)
  if (!offerDay) {
    throw new Error("demo plan: no free front-of-house candidate for the shift offer")
  }
  const accepting = offerDay.free[0]
  const pendingRecipient = FOH.find((idx) => idx !== accepting)!

  const shiftOffer = {
    date: addDays(nextMonday, offerDay.day),
    startTime: "16:00",
    endTime: "23:00",
    jobRole: ROLES.foh,
    breakMinutes: 30,
    note: isDa ? "Ekstra travlt — koncert i byen" : "Extra busy — concert in town",
    deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    recipients: [
      { employeeId: employeeIds[accepting], response: "ACCEPTED" as const },
      { employeeId: employeeIds[pendingRecipient], response: "PENDING" as const },
    ],
  }

  // ── Availability for next week ──────────────────────────────────────────────
  // "Can't work" days are only ever marked on days that person is NOT rostered,
  // so the Day Off badges agree with the roster instead of contradicting it —
  // and never on the day the offer's accepting candidate just volunteered for.
  const responders = [4, 5, 6, 7, 8]
  const unavailableByEmp = new Map<number, Set<number>>()
  for (const idx of responders) {
    const free = freeDays(1, idx).filter((d) => !(idx === accepting && d === offerDay.day))
    // One "can't work" day each is enough to show the Day Off badge, and leaves
    // headroom so a later change can still find a free, available candidate.
    unavailableByEmp.set(idx, new Set(free.slice(0, 1)))
  }

  const availability = {
    weekStart: nextMonday,
    deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    submissions: responders.map((idx) => ({
      employeeId: employeeIds[idx],
      days: Array.from({ length: 7 }, (_, d) => {
        const off = unavailableByEmp.get(idx)!.has(d)
        return {
          date: addDays(nextMonday, d),
          isAvailable: !off,
          startTime: off ? null : "12:00",
          endTime: off ? null : "23:00",
        }
      }),
    })),
  }

  // ── Time off ────────────────────────────────────────────────────────────────
  // An approved holiday means the shifts came off the roster — so we remove
  // them, exactly as a manager would. That keeps "approved leave" and "rostered"
  // from ever being true at once (DEMO-011).
  const holidayEmp = 2
  const holidayStartDay = 1
  const holidayEndDay = 3
  const holidayWeekStart = addDays(monday0, 14)
  const holidayStart = addDays(holidayWeekStart, holidayStartDay)
  const holidayEnd = addDays(holidayWeekStart, holidayEndDay)
  const holidayScheduleId = scheduleIdByWeek.get(2)!
  for (let i = shifts.length - 1; i >= 0; i--) {
    const s = shifts[i]
    if (
      s.scheduleId === holidayScheduleId &&
      s.employeeId === employeeIds[holidayEmp] &&
      s.date >= holidayStart &&
      s.date <= holidayEnd
    ) {
      shifts.splice(i, 1)
    }
  }

  // The pending request sits in a draft week and is deliberately left colliding-
  // free by picking days that person isn't rostered on — a manager reviewing it
  // should see a clean approve, not a conflict they didn't create.
  const pendingEmp = 6
  const pendingFree = freeDays(3, pendingEmp)
  const pendingWeekStart = addDays(monday0, 21)
  const pendingStartDay = pendingFree[0] ?? 0
  const pendingEndDay = pendingFree[1] ?? pendingStartDay

  const timeOff = [
    {
      employeeId: employeeIds[holidayEmp],
      startDate: holidayStart,
      endDate: holidayEnd,
      reason: isDa ? "Ferie" : "Holiday",
      status: "APPROVED" as const,
    },
    {
      employeeId: employeeIds[pendingEmp],
      startDate: addDays(pendingWeekStart, Math.min(pendingStartDay, pendingEndDay)),
      endDate: addDays(pendingWeekStart, Math.max(pendingStartDay, pendingEndDay)),
      reason: isDa ? "Familiebesøg" : "Family visit",
      status: "PENDING" as const,
    },
  ]

  // ── Cover request on a rolled-out shift in the landing week ─────────────────
  const coverShift = shifts.find(
    (s) =>
      s.scheduleId === scheduleIdByWeek.get(0) &&
      s.employeeId === employeeIds[4] &&
      !s.cancelledAt &&
      s.colorTag !== "sick",
  )
  if (!coverShift) {
    throw new Error("demo plan: no cover-request candidate in the landing week")
  }
  const coverRequest = {
    shiftId: coverShift.id,
    requesterEmployeeId: employeeIds[4],
    note: isDa ? "Har fået en aftale, jeg ikke kan flytte" : "Got an appointment I can't move",
  }

  return {
    locale,
    now,
    monday0,
    org: {
      name: isDa ? "Den Gyldne Pande" : "The Copper Pan",
      slug: `demo-${suffix}`,
      seats: people.length,
      currency: isDa ? "DKK" : "EUR",
      country: isDa ? "DK" : "GB",
      locale,
      settings: { hours, defaultScheduleView: "week", timeOffEnabled: true, timeFormat: "24h" },
    },
    manager,
    jobRoles: [
      { name: ROLES.kitchen, color: "orange" },
      { name: ROLES.foh, color: "blue" },
      { name: ROLES.bar, color: "purple" },
    ],
    shiftTemplates: [
      { name: isDa ? "Køkken tidlig" : "Kitchen early", startTime: "14:00", endTime: "22:00", breakMinutes: 30, jobRole: ROLES.kitchen, colorTag: "orange", sortOrder: 0 },
      { name: isDa ? "Køkken sen" : "Kitchen late", startTime: "15:00", endTime: "23:00", breakMinutes: 30, jobRole: ROLES.kitchen, colorTag: "orange", sortOrder: 1 },
      { name: isDa ? "Aftenservice" : "Dinner service", startTime: "16:00", endTime: "23:00", breakMinutes: 30, jobRole: ROLES.foh, colorTag: "blue", sortOrder: 2 },
      { name: isDa ? "Bar aften" : "Evening bar", startTime: "16:00", endTime: "23:00", breakMinutes: 0, jobRole: ROLES.bar, colorTag: "purple", sortOrder: 3 },
    ],
    employees,
    schedules,
    shifts,
    timeEntries,
    availability,
    timeOff,
    coverRequest,
    shiftOffer,
    landing: { weekStart: monday0, day: getLocalISO(now), view: "week" },
  }
}

/** Local YYYY-MM-DD for a given instant — matches dateUtils.todayISO(). */
function getLocalISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}
