import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL ?? "" })
const db = new PrismaClient({ adapter })

// ---------------------------------------------------------------------------
// Fixed IDs — keeping these stable makes the seed idempotent
// ---------------------------------------------------------------------------

const IDS = {
  org: "org_thedailygrind_001",

  userAlex: "user_alex_manager_001",
  membershipAlex: "mem_alex_manager_001",

  empSarah: "emp_sarah_chen_001",
  empJames: "emp_james_obrien_001",
  empMia: "emp_mia_andersen_001",
  empTom: "emp_tom_eriksson_001",
  empLena: "emp_lena_schmidt_001",
  empNadia: "emp_nadia_patel_001",

  schedule: "sched_current_week_001",

  // Shifts — Mon(3) Tue(3) Wed(4) Thu(4) Fri(6) Sat(5) = 25
  shift01: "shift_mon_sarah_morning_001",
  shift02: "shift_mon_lena_short_001",
  shift03: "shift_mon_tom_kitchen_001",
  shift04: "shift_tue_sarah_morning_001",
  shift05: "shift_tue_mia_mid_001",
  shift06: "shift_tue_tom_morning_001",
  shift07: "shift_wed_lena_morning_001",
  shift08: "shift_wed_nadia_afternoon_001",
  shift09: "shift_wed_james_morning_001",
  shift10: "shift_wed_mia_short_001",
  shift11: "shift_thu_sarah_morning_001",
  shift12: "shift_thu_tom_mid_001",
  shift13: "shift_thu_mia_afternoon_001",
  shift14: "shift_thu_nadia_late_001",
  shift15: "shift_fri_lena_morning_001",
  shift16: "shift_fri_sarah_morning_001",
  shift17: "shift_fri_nadia_rush_001",
  shift18: "shift_fri_tom_kitchen_001",
  shift19: "shift_fri_mia_afternoon_001",
  shift20: "shift_fri_james_evening_001",
  shift21: "shift_sat_sarah_morning_001",
  shift22: "shift_sat_lena_rush_001",
  shift23: "shift_sat_tom_morning_001",
  shift24: "shift_sat_nadia_mid_001",
  shift25: "shift_sat_james_evening_001",

  availRequest: "avail_req_next_week_001",

  subSarah: "avail_sub_sarah_001",
  subJames: "avail_sub_james_001",
  subMia: "avail_sub_mia_001",
  subLena: "avail_sub_lena_001",

  // Scheduling events
  evtScheduleCreated: "evt_schedule_created_001",
  evtShiftCreated01: "evt_shift_created_001",
  evtShiftCreated02: "evt_shift_created_002",
  evtShiftCreated03: "evt_shift_created_003",
  evtScheduleDuplicated: "evt_schedule_duplicated_001",
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Returns the most recent Monday at 00:00:00 UTC */
function getMondayOfCurrentWeek(): Date {
  const today = new Date()
  const day = today.getUTCDay() // 0 = Sun, 1 = Mon, …
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setUTCDate(today.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

/** Add `n` days to a Date */
function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + n)
  return d
}

/** Build a Date for a given weekday offset from weekStart, at 00:00:00 UTC */
function weekDay(weekStart: Date, offset: number): Date {
  return addDays(weekStart, offset)
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

async function main() {
  const currentWeekStart = getMondayOfCurrentWeek()
  const nextWeekStart = addDays(currentWeekStart, 7)

  // Next Sunday at 23:59
  const nextSunday = addDays(nextWeekStart, 6)
  nextSunday.setUTCHours(23, 59, 0, 0)

  // ---------------------------------------------------------------------------
  // 1. Organization
  // ---------------------------------------------------------------------------
  console.log("Seeding organization...")

  await db.organization.upsert({
    where: { slug: "the-daily-grind" },
    create: {
      id: IDS.org,
      name: "The Daily Grind",
      slug: "the-daily-grind",
      subscriptionStatus: "ACTIVE",
      employeeCount: 6,
    },
    update: {
      name: "The Daily Grind",
      subscriptionStatus: "ACTIVE",
      employeeCount: 6,
    },
  })

  // ---------------------------------------------------------------------------
  // 2. Manager user + membership
  // ---------------------------------------------------------------------------
  console.log("Seeding manager user...")

  await db.user.upsert({
    where: { email: "alex@thedailygrind.com" },
    create: {
      id: IDS.userAlex,
      name: "Alex Manager",
      email: "alex@thedailygrind.com",
      role: "MANAGER",
    },
    update: {
      name: "Alex Manager",
      role: "MANAGER",
    },
  })

  await db.membership.upsert({
    where: { userId_organizationId: { userId: IDS.userAlex, organizationId: IDS.org } },
    create: {
      id: IDS.membershipAlex,
      userId: IDS.userAlex,
      organizationId: IDS.org,
      role: "MANAGER",
    },
    update: {
      role: "MANAGER",
    },
  })

  // ---------------------------------------------------------------------------
  // 3. Employees
  // ---------------------------------------------------------------------------
  console.log("Seeding employees...")

  const employees = [
    {
      id: IDS.empSarah,
      name: "Sarah Chen",
      email: "sarah.chen@thedailygrind.com",
      jobRole: "Barista",
      hourlyWage: 14.0,
      employmentType: "FULL_TIME" as const,
      contractedHours: 40,
    },
    {
      id: IDS.empJames,
      name: "James O'Brien",
      email: "james.obrien@thedailygrind.com",
      jobRole: "Barista",
      hourlyWage: 13.0,
      employmentType: "PART_TIME" as const,
      contractedHours: 20,
    },
    {
      id: IDS.empMia,
      name: "Mia Andersen",
      email: "mia.andersen@thedailygrind.com",
      jobRole: "Cashier",
      hourlyWage: 12.5,
      employmentType: "PART_TIME" as const,
      contractedHours: 24,
    },
    {
      id: IDS.empTom,
      name: "Tom Eriksson",
      email: "tom.eriksson@thedailygrind.com",
      jobRole: "Kitchen Staff",
      hourlyWage: 13.5,
      employmentType: "FULL_TIME" as const,
      contractedHours: 40,
    },
    {
      id: IDS.empLena,
      name: "Lena Schmidt",
      email: "lena.schmidt@thedailygrind.com",
      jobRole: "Shift Supervisor",
      hourlyWage: 16.0,
      employmentType: "REDUCED_FULL_TIME" as const,
      contractedHours: 32,
    },
    {
      id: IDS.empNadia,
      name: "Nadia Patel",
      email: "nadia.patel@thedailygrind.com",
      jobRole: "Barista",
      hourlyWage: 13.0,
      employmentType: "PART_TIME" as const,
      contractedHours: 16,
    },
  ]

  for (const emp of employees) {
    await db.employee.upsert({
      where: { organizationId_email: { organizationId: IDS.org, email: emp.email } },
      create: {
        id: emp.id,
        organizationId: IDS.org,
        name: emp.name,
        email: emp.email,
        jobRole: emp.jobRole,
        hourlyWage: emp.hourlyWage,
        employmentType: emp.employmentType,
        contractedHours: emp.contractedHours,
        isActive: true,
      },
      update: {
        name: emp.name,
        jobRole: emp.jobRole,
        hourlyWage: emp.hourlyWage,
        employmentType: emp.employmentType,
        contractedHours: emp.contractedHours,
        isActive: true,
      },
    })
  }

  // ---------------------------------------------------------------------------
  // 3b. Job Roles
  // ---------------------------------------------------------------------------
  console.log("Seeding job roles...")

  const DEFAULT_ROLES = [
    { id: "role_barista_001", name: "Barista", color: "blue" },
    { id: "role_kitchen_001", name: "Kitchen", color: "orange" },
    { id: "role_cashier_001", name: "Cashier", color: "green" },
    { id: "role_supervisor_001", name: "Supervisor", color: "purple" },
    { id: "role_server_001", name: "Server", color: "yellow" },
  ]

  for (const role of DEFAULT_ROLES) {
    await db.jobRole.upsert({
      where: { organizationId_name: { organizationId: IDS.org, name: role.name } },
      create: {
        id: role.id,
        organizationId: IDS.org,
        name: role.name,
        color: role.color,
      },
      update: {
        color: role.color,
      },
    })
  }

  // ---------------------------------------------------------------------------
  // 4. Schedule (current week)
  // ---------------------------------------------------------------------------
  console.log("Seeding schedule...")

  await db.schedule.upsert({
    where: { id: IDS.schedule },
    create: {
      id: IDS.schedule,
      organizationId: IDS.org,
      weekStart: currentWeekStart,
      isDuplicate: false,
    },
    update: {
      weekStart: currentWeekStart,
    },
  })

  // ---------------------------------------------------------------------------
  // 5. Shifts — 25 across Mon–Sat with realistic variation
  //    Mon: quiet (3)  Tue: steady (3)  Wed: medium (4)
  //    Thu: building (4)  Fri: busiest with overlaps (6)  Sat: heavy morning (5)
  // ---------------------------------------------------------------------------
  console.log("Seeding shifts...")

  const shifts = [
    // ── Monday — quiet opening day ──────────────────────────────────────────
    {
      id: IDS.shift01,
      employeeId: IDS.empSarah,
      date: weekDay(currentWeekStart, 0),
      startTime: "07:00",
      endTime: "15:00",
      breakMinutes: 30,
      jobRole: "Barista",
      colorTag: "blue",
      notes: null,
    },
    {
      id: IDS.shift02,
      employeeId: IDS.empLena,
      date: weekDay(currentWeekStart, 0),
      startTime: "08:00",
      endTime: "14:00",
      breakMinutes: 0,
      jobRole: "Supervisor",
      colorTag: "purple",
      notes: "Opening shift",
    },
    {
      id: IDS.shift03,
      employeeId: IDS.empTom,
      date: weekDay(currentWeekStart, 0),
      startTime: "09:00",
      endTime: "15:00",
      breakMinutes: 0,
      jobRole: "Kitchen",
      colorTag: "orange",
      notes: null,
    },

    // ── Tuesday — steady mid-week ────────────────────────────────────────────
    {
      id: IDS.shift04,
      employeeId: IDS.empSarah,
      date: weekDay(currentWeekStart, 1),
      startTime: "07:00",
      endTime: "15:00",
      breakMinutes: 30,
      jobRole: "Barista",
      colorTag: "blue",
      notes: null,
    },
    {
      id: IDS.shift05,
      employeeId: IDS.empMia,
      date: weekDay(currentWeekStart, 1),
      startTime: "09:00",
      endTime: "17:00",
      breakMinutes: 30,
      jobRole: "Cashier",
      colorTag: "green",
      notes: null,
    },
    {
      id: IDS.shift06,
      employeeId: IDS.empTom,
      date: weekDay(currentWeekStart, 1),
      startTime: "07:00",
      endTime: "15:00",
      breakMinutes: 30,
      jobRole: "Kitchen",
      colorTag: "orange",
      notes: null,
    },

    // ── Wednesday — four staff, staggered ───────────────────────────────────
    {
      id: IDS.shift07,
      employeeId: IDS.empLena,
      date: weekDay(currentWeekStart, 2),
      startTime: "08:00",
      endTime: "16:00",
      breakMinutes: 30,
      jobRole: "Supervisor",
      colorTag: "purple",
      notes: null,
    },
    {
      id: IDS.shift08,
      employeeId: IDS.empNadia,
      date: weekDay(currentWeekStart, 2),
      startTime: "11:00",
      endTime: "19:00",
      breakMinutes: 30,
      jobRole: "Barista",
      colorTag: "blue",
      notes: null,
    },
    {
      id: IDS.shift09,
      employeeId: IDS.empJames,
      date: weekDay(currentWeekStart, 2),
      startTime: "07:00",
      endTime: "15:00",
      breakMinutes: 30,
      jobRole: "Barista",
      colorTag: "blue",
      notes: null,
    },
    {
      id: IDS.shift10,
      employeeId: IDS.empMia,
      date: weekDay(currentWeekStart, 2),
      startTime: "07:00",
      endTime: "13:00",
      breakMinutes: 0,
      jobRole: "Cashier",
      colorTag: "green",
      notes: null,
    },

    // ── Thursday — building towards weekend ─────────────────────────────────
    {
      id: IDS.shift11,
      employeeId: IDS.empSarah,
      date: weekDay(currentWeekStart, 3),
      startTime: "07:00",
      endTime: "15:00",
      breakMinutes: 30,
      jobRole: "Barista",
      colorTag: "blue",
      notes: null,
    },
    {
      id: IDS.shift12,
      employeeId: IDS.empTom,
      date: weekDay(currentWeekStart, 3),
      startTime: "10:00",
      endTime: "18:00",
      breakMinutes: 30,
      jobRole: "Kitchen",
      colorTag: "orange",
      notes: null,
    },
    {
      id: IDS.shift13,
      employeeId: IDS.empMia,
      date: weekDay(currentWeekStart, 3),
      startTime: "11:00",
      endTime: "19:00",
      breakMinutes: 30,
      jobRole: "Cashier",
      colorTag: "green",
      notes: null,
    },
    {
      id: IDS.shift14,
      employeeId: IDS.empNadia,
      date: weekDay(currentWeekStart, 3),
      startTime: "14:00",
      endTime: "20:00",
      breakMinutes: 0,
      jobRole: "Barista",
      colorTag: "blue",
      notes: null,
    },

    // ── Friday — busiest day, 6 shifts with overlaps ─────────────────────────
    {
      id: IDS.shift15,
      employeeId: IDS.empLena,
      date: weekDay(currentWeekStart, 4),
      startTime: "07:00",
      endTime: "15:00",
      breakMinutes: 30,
      jobRole: "Supervisor",
      colorTag: "purple",
      notes: "Pre-weekend briefing",
    },
    {
      id: IDS.shift16,
      employeeId: IDS.empSarah,
      date: weekDay(currentWeekStart, 4),
      startTime: "07:00",
      endTime: "15:00",
      breakMinutes: 30,
      jobRole: "Barista",
      colorTag: "blue",
      notes: null,
    },
    {
      id: IDS.shift17,
      employeeId: IDS.empNadia,
      date: weekDay(currentWeekStart, 4),
      startTime: "07:00",
      endTime: "13:00",
      breakMinutes: 0,
      jobRole: "Barista",
      colorTag: "blue",
      notes: "Morning rush cover",
    },
    {
      id: IDS.shift18,
      employeeId: IDS.empTom,
      date: weekDay(currentWeekStart, 4),
      startTime: "08:00",
      endTime: "16:00",
      breakMinutes: 30,
      jobRole: "Kitchen",
      colorTag: "orange",
      notes: null,
    },
    {
      id: IDS.shift19,
      employeeId: IDS.empMia,
      date: weekDay(currentWeekStart, 4),
      startTime: "11:00",
      endTime: "19:00",
      breakMinutes: 30,
      jobRole: "Cashier",
      colorTag: "green",
      notes: null,
    },
    {
      id: IDS.shift20,
      employeeId: IDS.empJames,
      date: weekDay(currentWeekStart, 4),
      startTime: "14:00",
      endTime: "21:00",
      breakMinutes: 0,
      jobRole: "Barista",
      colorTag: "blue",
      notes: "Evening close",
    },

    // ── Saturday — heavy morning rush, 5 shifts ──────────────────────────────
    {
      id: IDS.shift21,
      employeeId: IDS.empSarah,
      date: weekDay(currentWeekStart, 5),
      startTime: "07:00",
      endTime: "15:00",
      breakMinutes: 30,
      jobRole: "Barista",
      colorTag: "blue",
      notes: null,
    },
    {
      id: IDS.shift22,
      employeeId: IDS.empLena,
      date: weekDay(currentWeekStart, 5),
      startTime: "07:00",
      endTime: "13:00",
      breakMinutes: 0,
      jobRole: "Supervisor",
      colorTag: "purple",
      notes: "Morning rush supervisor",
    },
    {
      id: IDS.shift23,
      employeeId: IDS.empTom,
      date: weekDay(currentWeekStart, 5),
      startTime: "07:00",
      endTime: "15:00",
      breakMinutes: 30,
      jobRole: "Kitchen",
      colorTag: "orange",
      notes: null,
    },
    {
      id: IDS.shift24,
      employeeId: IDS.empNadia,
      date: weekDay(currentWeekStart, 5),
      startTime: "09:00",
      endTime: "17:00",
      breakMinutes: 30,
      jobRole: "Barista",
      colorTag: "blue",
      notes: null,
    },
    {
      id: IDS.shift25,
      employeeId: IDS.empJames,
      date: weekDay(currentWeekStart, 5),
      startTime: "15:00",
      endTime: "21:00",
      breakMinutes: 0,
      jobRole: "Barista",
      colorTag: "blue",
      notes: "Evening close",
    },
  ]

  for (const shift of shifts) {
    await db.shift.upsert({
      where: { id: shift.id },
      create: {
        id: shift.id,
        scheduleId: IDS.schedule,
        organizationId: IDS.org,
        employeeId: shift.employeeId,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes,
        jobRole: shift.jobRole,
        colorTag: shift.colorTag ?? null,
        notes: shift.notes,
      },
      update: {
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes,
        jobRole: shift.jobRole,
        colorTag: shift.colorTag ?? null,
        notes: shift.notes,
      },
    })
  }

  // ---------------------------------------------------------------------------
  // 6. AvailabilityRequest (next week)
  // ---------------------------------------------------------------------------
  console.log("Seeding availability request...")

  await db.availabilityRequest.upsert({
    where: { id: IDS.availRequest },
    create: {
      id: IDS.availRequest,
      organizationId: IDS.org,
      weekStart: nextWeekStart,
      deadline: nextSunday,
      status: "OPEN",
    },
    update: {
      weekStart: nextWeekStart,
      deadline: nextSunday,
      status: "OPEN",
    },
  })

  // ---------------------------------------------------------------------------
  // 7. AvailabilitySubmissions + AvailabilityDays
  //    4 of 6 employees have responded: Sarah, James, Mia, Lena
  //    AvailabilityDay has no stable unique key, so we delete + recreate
  //    the days each run (submission itself is upserted by requestId+employeeId)
  // ---------------------------------------------------------------------------
  console.log("Seeding availability submissions...")

  // Helper: build 7-day availability arrays for next week
  // Each entry: { offset, isAvailable, preferredStart?, preferredEnd? }
  type DayPlan = {
    offset: number
    isAvailable: boolean
    preferredStart?: string
    preferredEnd?: string
  }

  const submissionData: Array<{
    subId: string
    employeeId: string
    days: DayPlan[]
  }> = [
    {
      subId: IDS.subSarah,
      employeeId: IDS.empSarah,
      days: [
        { offset: 0, isAvailable: true, preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 1, isAvailable: true, preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 2, isAvailable: false },
        { offset: 3, isAvailable: true, preferredStart: "11:00", preferredEnd: "19:00" },
        { offset: 4, isAvailable: true, preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 5, isAvailable: true, preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 6, isAvailable: false },
      ],
    },
    {
      subId: IDS.subJames,
      employeeId: IDS.empJames,
      days: [
        { offset: 0, isAvailable: true, preferredStart: "11:00", preferredEnd: "19:00" },
        { offset: 1, isAvailable: false },
        { offset: 2, isAvailable: true, preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 3, isAvailable: true, preferredStart: "11:00", preferredEnd: "19:00" },
        { offset: 4, isAvailable: true, preferredStart: "15:00", preferredEnd: "22:00" },
        { offset: 5, isAvailable: false },
        { offset: 6, isAvailable: false },
      ],
    },
    {
      subId: IDS.subMia,
      employeeId: IDS.empMia,
      days: [
        { offset: 0, isAvailable: true, preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 1, isAvailable: true, preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 2, isAvailable: true, preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 3, isAvailable: false },
        { offset: 4, isAvailable: true, preferredStart: "11:00", preferredEnd: "19:00" },
        { offset: 5, isAvailable: true, preferredStart: "11:00", preferredEnd: "19:00" },
        { offset: 6, isAvailable: false },
      ],
    },
    {
      subId: IDS.subLena,
      employeeId: IDS.empLena,
      days: [
        { offset: 0, isAvailable: true, preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 1, isAvailable: true, preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 2, isAvailable: true, preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 3, isAvailable: true, preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 4, isAvailable: true, preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 5, isAvailable: false },
        { offset: 6, isAvailable: false },
      ],
    },
  ]

  for (const sub of submissionData) {
    // Upsert the submission record itself
    await db.availabilitySubmission.upsert({
      where: { requestId_employeeId: { requestId: IDS.availRequest, employeeId: sub.employeeId } },
      create: {
        id: sub.subId,
        requestId: IDS.availRequest,
        employeeId: sub.employeeId,
        organizationId: IDS.org,
      },
      update: {}, // submittedAt is auto-set; nothing else to update on the parent
    })

    // Refresh days: delete existing, recreate (AvailabilityDay has no stable unique key)
    await db.availabilityDay.deleteMany({ where: { submissionId: sub.subId } })

    await db.availabilityDay.createMany({
      data: sub.days.map((d) => ({
        submissionId: sub.subId,
        date: weekDay(nextWeekStart, d.offset),
        isAvailable: d.isAvailable,
        preferredStart: d.isAvailable ? (d.preferredStart ?? null) : null,
        preferredEnd: d.isAvailable ? (d.preferredEnd ?? null) : null,
      })),
    })
  }

  // ---------------------------------------------------------------------------
  // 8. SchedulingEvents (AI training data)
  // ---------------------------------------------------------------------------
  console.log("Seeding scheduling events...")

  const schedulingEvents = [
    {
      id: IDS.evtScheduleCreated,
      eventType: "SCHEDULE_CREATED",
      payload: {
        scheduleId: IDS.schedule,
        weekStart: currentWeekStart.toISOString(),
        organizationId: IDS.org,
      },
    },
    {
      id: IDS.evtShiftCreated01,
      eventType: "SHIFT_CREATED",
      payload: {
        shiftId: IDS.shift01,
        scheduleId: IDS.schedule,
        employeeId: IDS.empSarah,
        date: weekDay(currentWeekStart, 0).toISOString(),
        startTime: "07:00",
        endTime: "15:00",
        jobRole: "Barista",
      },
    },
    {
      id: IDS.evtShiftCreated02,
      eventType: "SHIFT_CREATED",
      payload: {
        shiftId: IDS.shift02,
        scheduleId: IDS.schedule,
        employeeId: IDS.empLena,
        date: weekDay(currentWeekStart, 0).toISOString(),
        startTime: "08:00",
        endTime: "14:00",
        jobRole: "Supervisor",
      },
    },
    {
      id: IDS.evtShiftCreated03,
      eventType: "SHIFT_CREATED",
      payload: {
        shiftId: IDS.shift20,
        scheduleId: IDS.schedule,
        employeeId: IDS.empJames,
        date: weekDay(currentWeekStart, 4).toISOString(),
        startTime: "14:00",
        endTime: "21:00",
        jobRole: "Barista",
      },
    },
    {
      id: IDS.evtScheduleDuplicated,
      eventType: "SCHEDULE_DUPLICATED",
      payload: {
        sourceScheduleId: IDS.schedule,
        newScheduleId: IDS.schedule,
        weekStart: currentWeekStart.toISOString(),
        shiftCount: 25,
      },
    },
  ]

  for (const evt of schedulingEvents) {
    await db.schedulingEvent.upsert({
      where: { id: evt.id },
      create: {
        id: evt.id,
        organizationId: IDS.org,
        eventType: evt.eventType,
        payload: evt.payload,
      },
      update: {
        eventType: evt.eventType,
        payload: evt.payload,
      },
    })
  }

  console.log("Seed complete.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
