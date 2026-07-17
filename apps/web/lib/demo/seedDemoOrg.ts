import "server-only"
import { db } from "@/lib/prisma"
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo/constants"

/**
 * Creates a fully-populated throwaway restaurant for the "try the live demo"
 * flow and returns the manager user to sign the visitor in as.
 *
 * The sandbox is the REAL product with realistic content:
 *  - 9 employees (per-locale name cast matching the marketing previews)
 *  - 8 past weeks: rolled-out shifts + clocked time entries (costs/timesheets
 *    look alive), a sick day or two, one cancelled shift
 *  - current + next week rolled out; weeks +2…+7 are private drafts, so the
 *    Roll out flow demos itself
 *  - an open availability request (with "can't work" days → Day Off badges),
 *    time-off (approved + pending), an open cover request, and an open shift
 *    offer with one accepted candidate
 *
 * Safety: `isDemo: true` (48h TTL via the cleanup cron, excluded from platform
 * metrics), all people live on DEMO_EMAIL_DOMAIN (lib/resend.ts refuses to
 * deliver there), employees have no phone/userId so SMS/push are impossible.
 *
 * Deterministic (no randomness) so tests can assert exact shapes; variety comes
 * from week/day rotation.
 */

type DemoLocale = "en" | "da"

interface CastMember {
  name: string
  jobRole: string
  wage: number // in org currency
  contractedHours: number
}

const ROLES = { kitchen: "Kitchen", foh: "Front of house", bar: "Bar" } as const

function cast(locale: DemoLocale): CastMember[] {
  // Index layout: 0–3 Kitchen (0 = head chef), 4–6 Front of house, 7–8 Bar.
  // First names match the localized marketing previews (James/Sarah/Olivia/
  // Emma/Tom — Mads/Freja/Ida/Sofie/Mikkel).
  const k = ROLES.kitchen, f = ROLES.foh, b = ROLES.bar
  if (locale === "da") {
    return [
      { name: "Mads Jensen",     jobRole: k, wage: 139, contractedHours: 40 },
      { name: "Freja Nielsen",   jobRole: k, wage: 116, contractedHours: 38 },
      { name: "Anders Holm",     jobRole: k, wage: 105, contractedHours: 32 },
      { name: "Oliver Skov",     jobRole: k, wage: 86,  contractedHours: 16 },
      { name: "Sofie Larsen",    jobRole: f, wage: 94,  contractedHours: 25 },
      { name: "Mikkel Andersen", jobRole: f, wage: 90,  contractedHours: 20 },
      { name: "Clara Berg",      jobRole: f, wage: 90,  contractedHours: 16 },
      { name: "Ida Hansen",      jobRole: b, wage: 101, contractedHours: 30 },
      { name: "Emil Lund",       jobRole: b, wage: 98,  contractedHours: 20 },
    ]
  }
  return [
    { name: "James Walker",   jobRole: k, wage: 18.5, contractedHours: 40 },
    { name: "Sarah Brooks",   jobRole: k, wage: 15.5, contractedHours: 38 },
    { name: "Daniel Foster",  jobRole: k, wage: 14,   contractedHours: 32 },
    { name: "Oliver Reed",    jobRole: k, wage: 11.5, contractedHours: 16 },
    { name: "Emma Clarke",    jobRole: f, wage: 12.5, contractedHours: 25 },
    { name: "Tom Hughes",     jobRole: f, wage: 12,   contractedHours: 20 },
    { name: "Lucy Palmer",    jobRole: f, wage: 12,   contractedHours: 16 },
    { name: "Olivia Bennett", jobRole: b, wage: 13.5, contractedHours: 30 },
    { name: "Jack Murphy",    jobRole: b, wage: 13,   contractedHours: 20 },
  ]
}

// ── Date helpers (UTC, YYYY-MM-DD — mirrors availabilityService conventions) ──

function currentMondayISO(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff))
  return mon.toISOString().split("T")[0]
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split("T")[0]
}

function utcDate(iso: string): Date {
  return new Date(iso + "T00:00:00Z")
}

function utcDateTime(iso: string, hhmm: string): Date {
  return new Date(`${iso}T${hhmm}:00Z`)
}

/** Deterministic small hash for jitter/rotation. */
function h(n: number): number {
  return Math.abs((n * 2654435761) % 97)
}

// ── Weekly staffing pattern ───────────────────────────────────────────────────

type PlannedShift = {
  employeeIdx: number
  day: number // 0=Mon … 6=Sun (Mon is closed — never planned)
  startTime: string
  endTime: string
  breakMinutes: number
}

const KITCHEN = [0, 1, 2, 3]
const FOH = [4, 5, 6]
const BAR = [7, 8]

function pick(pool: number[], count: number, rotation: number): number[] {
  return Array.from({ length: Math.min(count, pool.length) }, (_, i) => pool[(rotation + i) % pool.length])
}

/** One week of shifts. Tue–Thu + Sun run lighter than Fri–Sat. */
function planWeek(weekIdx: number): PlannedShift[] {
  const out: PlannedShift[] = []
  for (let day = 1; day <= 6; day++) {
    const busy = day === 4 || day === 5 // Fri, Sat
    const rot = h(weekIdx * 7 + day)
    const kitchen = pick(KITCHEN, busy ? 3 : 2, rot)
    const foh = pick(FOH, busy ? 3 : 2, rot)
    const bar = pick(BAR, busy ? 2 : 1, rot)

    kitchen.forEach((idx, i) => out.push({
      employeeIdx: idx, day,
      startTime: i === 0 ? "14:00" : "15:00",
      endTime: i === 0 ? "22:00" : "23:00",
      breakMinutes: 30,
    }))
    foh.forEach((idx, i) => out.push({
      employeeIdx: idx, day,
      startTime: busy && i === 0 ? "12:00" : "16:00",
      endTime: busy && i === 0 ? "20:00" : "23:00",
      breakMinutes: 30,
    }))
    bar.forEach((idx) => out.push({
      employeeIdx: idx, day,
      startTime: "16:00", endTime: "23:00", breakMinutes: 0,
    }))
  }
  return out
}

// ── Main entry ────────────────────────────────────────────────────────────────

export interface DemoSeedResult {
  userId: string
  orgId: string
  email: string
  name: string
}

export async function seedDemoOrg(locale: DemoLocale): Promise<DemoSeedResult> {
  const suffix = crypto.randomUUID().slice(0, 8)
  const people = cast(locale)
  const isDa = locale === "da"

  const orgName = isDa ? "Den Gyldne Pande" : "The Copper Pan"
  const managerName = isDa ? "Lars Petersen" : "Michael Carter"
  const managerEmail = `demo-${suffix}@${DEMO_EMAIL_DOMAIN}`

  // Mon closed; dinner-service bistro the rest of the week.
  const hours = [
    { isOpen: false, openTime: "12:00", closeTime: "23:00" }, // Mon
    ...Array.from({ length: 6 }, () => ({ isOpen: true, openTime: "12:00", closeTime: "23:00" })),
  ]

  const org = await db.organization.create({
    data: {
      name: orgName,
      slug: `demo-${suffix}`,
      isDemo: true,
      subscriptionStatus: "TRIALING",
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      currency: isDa ? "DKK" : "EUR",
      country: isDa ? "DK" : "GB",
      locale,
      industry: "restaurant",
      settings: { hours, defaultScheduleView: "week", timeOffEnabled: true, timeFormat: "24h" },
    },
  })

  const user = await db.user.create({
    data: { name: managerName, email: managerEmail, role: "MANAGER" },
  })
  await db.membership.create({
    data: { userId: user.id, organizationId: org.id, role: "MANAGER" },
  })

  await db.jobRole.createMany({
    data: [
      { organizationId: org.id, name: ROLES.kitchen, color: "orange" },
      { organizationId: org.id, name: ROLES.foh, color: "blue" },
      { organizationId: org.id, name: ROLES.bar, color: "purple" },
    ],
  })

  await db.shiftTemplate.createMany({
    data: [
      { organizationId: org.id, name: isDa ? "Køkken tidlig" : "Kitchen early", startTime: "14:00", endTime: "22:00", breakMinutes: 30, jobRole: ROLES.kitchen, colorTag: "orange", sortOrder: 0 },
      { organizationId: org.id, name: isDa ? "Køkken sen" : "Kitchen late", startTime: "15:00", endTime: "23:00", breakMinutes: 30, jobRole: ROLES.kitchen, colorTag: "orange", sortOrder: 1 },
      { organizationId: org.id, name: isDa ? "Aftenservice" : "Dinner service", startTime: "16:00", endTime: "23:00", breakMinutes: 30, jobRole: ROLES.foh, colorTag: "blue", sortOrder: 2 },
      { organizationId: org.id, name: isDa ? "Bar aften" : "Evening bar", startTime: "16:00", endTime: "23:00", breakMinutes: 0, jobRole: ROLES.bar, colorTag: "purple", sortOrder: 3 },
    ],
  })

  // Employees — ids generated up-front so shifts can reference them in createMany.
  const employeeIds = people.map(() => crypto.randomUUID())
  await db.employee.createMany({
    data: people.map((p, i) => ({
      id: employeeIds[i],
      organizationId: org.id,
      name: p.name,
      email: `${p.name.toLowerCase().replace(/[^a-z]+/g, ".")}-${suffix}@${DEMO_EMAIL_DOMAIN}`,
      phone: null,
      userId: null,
      jobRole: p.jobRole,
      hourlyWage: p.wage,
      contractedHours: p.contractedHours,
      employmentType: p.contractedHours >= 37 ? "FULL_TIME" : "PART_TIME",
      isActive: true,
    })),
  })

  const roleColor = (jobRole: string) =>
    jobRole === ROLES.kitchen ? "orange" : jobRole === ROLES.foh ? "blue" : "purple"

  // ── Schedules + shifts: weeks -8 … +7 relative to the current Monday ────────
  const monday0 = currentMondayISO()
  const now = new Date()

  type ShiftRow = {
    id: string; scheduleId: string; organizationId: string; employeeId: string
    date: Date; startTime: string; endTime: string; breakMinutes: number
    jobRole: string; colorTag: string | null; notes: string | null
    publishedAt: Date | null; cancelledAt: Date | null
  }
  const shiftRows: ShiftRow[] = []
  const timeEntries: {
    organizationId: string; employeeId: string; shiftId: string
    clockIn: Date; clockOut: Date; breakMinutes: number
  }[] = []
  const scheduleIdByWeek = new Map<number, string>()

  for (let w = -8; w <= 7; w++) {
    const weekStart = addDaysISO(monday0, w * 7)
    const scheduleId = crypto.randomUUID()
    scheduleIdByWeek.set(w, scheduleId)
    // Weeks up to and incl. next week are rolled out; +2… are private drafts.
    const published = w <= 1 ? new Date(now.getTime() - (2 - w) * 24 * 60 * 60 * 1000) : null

    await db.schedule.create({
      data: {
        id: scheduleId,
        organizationId: org.id,
        weekStart: utcDate(weekStart),
        publishedAt: published,
      },
    })

    for (const s of planWeek(w)) {
      const dateISO = addDaysISO(weekStart, s.day)
      const shiftId = crypto.randomUUID()
      const person = people[s.employeeIdx]
      shiftRows.push({
        id: shiftId,
        scheduleId,
        organizationId: org.id,
        employeeId: employeeIds[s.employeeIdx],
        date: utcDate(dateISO),
        startTime: s.startTime,
        endTime: s.endTime,
        breakMinutes: s.breakMinutes,
        jobRole: person.jobRole,
        colorTag: roleColor(person.jobRole),
        notes: null,
        publishedAt: published,
        cancelledAt: null,
      })

      // Past weeks: clocked time entries for ~6 of 7 shifts, with small
      // deterministic jitter so timesheets/costs look human.
      if (w < 0 && h(w * 31 + s.day + s.employeeIdx) % 7 !== 0) {
        const jitterIn = (h(w + s.employeeIdx) % 3) * 5 - 5 // -5 | 0 | +5 min
        const jitterOut = (h(w * 3 + s.day) % 4) * 5 // 0 … +15 min
        const clockIn = new Date(utcDateTime(dateISO, s.startTime).getTime() + jitterIn * 60_000)
        const clockOut = new Date(utcDateTime(dateISO, s.endTime).getTime() + jitterOut * 60_000)
        timeEntries.push({
          organizationId: org.id,
          employeeId: employeeIds[s.employeeIdx],
          shiftId,
          clockIn,
          clockOut,
          breakMinutes: s.breakMinutes,
        })
      }
    }
  }

  // A cancelled shift last week (kept as a struck-through record) …
  const lastWeekRows = shiftRows.filter((r) => r.scheduleId === scheduleIdByWeek.get(-1))
  if (lastWeekRows.length > 2) lastWeekRows[2].cancelledAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)

  // … and two sick days in the recent past, on days those people weren't planned.
  const sickNote = isDa ? "Influenza" : "Flu"
  for (const [w, empIdx] of [[-2, 1], [-4, 5]] as const) {
    const weekStart = addDaysISO(monday0, w * 7)
    const planned = new Set(planWeek(w).filter((p) => p.employeeIdx === empIdx).map((p) => p.day))
    const freeDay = [1, 2, 3, 4, 5, 6].find((d) => !planned.has(d)) ?? 2
    shiftRows.push({
      id: crypto.randomUUID(),
      scheduleId: scheduleIdByWeek.get(w)!,
      organizationId: org.id,
      employeeId: employeeIds[empIdx],
      date: utcDate(addDaysISO(weekStart, freeDay)),
      startTime: "00:00",
      endTime: "00:00",
      breakMinutes: 0,
      jobRole: isDa ? "Sygedag" : "Sick Day",
      colorTag: "sick",
      notes: sickNote,
      publishedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      cancelledAt: null,
    })
  }

  await db.shift.createMany({ data: shiftRows })
  if (timeEntries.length > 0) await db.timeEntry.createMany({ data: timeEntries })

  // ── Availability request for next week, with "can't work" days ─────────────
  const nextMonday = addDaysISO(monday0, 7)
  const availability = await db.availabilityRequest.create({
    data: {
      organizationId: org.id,
      weekStart: utcDate(nextMonday),
      deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      status: "OPEN",
    },
  })
  // Five people responded; Tom/Mikkel (idx 5) can't work Fri+Sat → Day Off badges.
  for (const empIdx of [4, 5, 6, 7, 8]) {
    const submission = await db.availabilitySubmission.create({
      data: {
        requestId: availability.id,
        employeeId: employeeIds[empIdx],
        organizationId: org.id,
      },
    })
    await db.availabilityDay.createMany({
      data: Array.from({ length: 7 }, (_, d) => {
        const unavailable = empIdx === 5 && (d === 4 || d === 5)
        return {
          submissionId: submission.id,
          date: utcDate(addDaysISO(nextMonday, d)),
          isAvailable: !unavailable,
          startTime: unavailable ? null : "12:00",
          endTime: unavailable ? null : "23:00",
        }
      }),
    })
  }

  // ── Time off: one approved (draft week +2), one pending (+3) ────────────────
  await db.timeOffRequest.createMany({
    data: [
      {
        organizationId: org.id,
        employeeId: employeeIds[2],
        startDate: utcDate(addDaysISO(monday0, 14 + 1)),
        endDate: utcDate(addDaysISO(monday0, 14 + 3)),
        reason: isDa ? "Ferie" : "Holiday",
        status: "APPROVED",
      },
      {
        organizationId: org.id,
        employeeId: employeeIds[6],
        startDate: utcDate(addDaysISO(monday0, 21 + 4)),
        endDate: utcDate(addDaysISO(monday0, 21 + 5)),
        reason: isDa ? "Familiebesøg" : "Family visit",
        status: "PENDING",
      },
    ],
  })

  // ── An open cover request on a rolled-out shift this week ───────────────────
  const coverShift = shiftRows.find(
    (r) => r.scheduleId === scheduleIdByWeek.get(0) && r.employeeId === employeeIds[4] && !r.cancelledAt && r.colorTag !== "sick",
  )
  if (coverShift) {
    await db.shiftCoverRequest.create({
      data: {
        organizationId: org.id,
        shiftId: coverShift.id,
        requesterEmployeeId: employeeIds[4],
        status: "OPEN",
        note: isDa ? "Har fået en aftale, jeg ikke kan flytte" : "Got an appointment I can't move",
      },
    })
  }

  // ── An open shift offer with one accepted candidate (Confirm demo) ──────────
  await db.shiftOffer.create({
    data: {
      organizationId: org.id,
      date: utcDate(addDaysISO(nextMonday, 5)), // next Saturday
      startTime: "16:00",
      endTime: "23:00",
      jobRole: ROLES.foh,
      breakMinutes: 30,
      note: isDa ? "Ekstra travl lørdag — koncert i byen" : "Extra busy Saturday — concert in town",
      deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      status: "OPEN",
      createdByUserId: user.id,
      recipients: {
        create: [
          { employeeId: employeeIds[5], response: "ACCEPTED", respondedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
          { employeeId: employeeIds[6], response: "PENDING" },
        ],
      },
    },
  })

  return { userId: user.id, orgId: org.id, email: managerEmail, name: managerName }
}
