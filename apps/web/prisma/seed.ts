import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { faker } from "@faker-js/faker"

// Fixed seed → every run produces identical faker output
faker.seed(20260514)

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL ?? "" })
const db = new PrismaClient({ adapter })

// ---------------------------------------------------------------------------
// Stable IDs — never change these; they make the seed idempotent
// ---------------------------------------------------------------------------

const IDS = {
  org: "org_thedailygrind_001",

  // Users — one per employee so every worker can sign in
  userAlex:   "user_alex_manager_001",
  userCasper: "user_casper_gamborg_001",
  userSarah:  "user_sarah_chen_001",
  userJames:  "user_james_obrien_001",
  userMia:    "user_mia_andersen_001",
  userTom:    "user_tom_eriksson_001",
  userLena:   "user_lena_schmidt_001",
  userNadia:  "user_nadia_patel_001",

  // Memberships
  memAlex:    "mem_alex_manager_001",
  memCasper:  "mem_casper_gamborg_001",
  memSarah:   "mem_sarah_chen_001",
  memJames:   "mem_james_obrien_001",
  memMia:     "mem_mia_andersen_001",
  memTom:     "mem_tom_eriksson_001",
  memLena:    "mem_lena_schmidt_001",
  memNadia:   "mem_nadia_patel_001",

  // Employees — Casper is the real admin; the rest are seeded personas
  empCasper:  "emp_casper_gamborg_001",
  empSarah:   "emp_sarah_chen_001",
  empJames:   "emp_james_obrien_001",
  empMia:     "emp_mia_andersen_001",
  empTom:     "emp_tom_eriksson_001",
  empLena:    "emp_lena_schmidt_001",
  empNadia:   "emp_nadia_patel_001",

  // Job roles
  roleBarista:    "role_barista_001",
  roleKitchen:    "role_kitchen_001",
  roleCashier:    "role_cashier_001",
  roleSupervisor: "role_supervisor_001",
  roleServer:     "role_server_001",

  // Shift templates
  tmplMorning:   "tmpl_morning_001",
  tmplAfternoon: "tmpl_afternoon_001",
  tmplEvening:   "tmpl_evening_001",
  tmplKitchenAm: "tmpl_kitchen_am_001",
  tmplKitchenPm: "tmpl_kitchen_pm_001",
  tmplOpening:   "tmpl_opening_001",

  // Schedules: W0 = current, W-1–W-4 = past, W+1–W+4 = future
  schedW0:  "sched_week_current_001",
  schedW1:  "sched_week_minus1_001",
  schedW2:  "sched_week_minus2_001",
  schedW3:  "sched_week_minus3_001",
  schedW4:  "sched_week_minus4_001",
  schedWp1: "sched_week_plus1_001",
  schedWp2: "sched_week_plus2_001",
  schedWp3: "sched_week_plus3_001",
  schedWp4: "sched_week_plus4_001",

  // Availability
  availReq:  "avail_req_next_week_001",
  subSarah:  "avail_sub_sarah_001",
  subJames:  "avail_sub_james_001",
  subMia:    "avail_sub_mia_001",
  subLena:   "avail_sub_lena_001",

  // Scheduling events
  evtSchedCreated:     "evt_schedule_created_001",
  evtShiftCreated_01:  "evt_shift_created_001",
  evtShiftCreated_02:  "evt_shift_created_002",
  evtShiftCreated_03:  "evt_shift_created_003",
  evtSchedDuplicated:  "evt_schedule_duplicated_001",
}

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

/** Monday of the current week at 00:00:00 UTC */
function currentMonday(): Date {
  const now = new Date()
  const day = now.getUTCDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

/** Add n whole days to a UTC date */
function addDays(base: Date, n: number): Date {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + n)
  return d
}

/** Weekday relative to a week's Monday (offset 0 = Mon, 5 = Sat, 6 = Sun) */
function weekDay(weekStart: Date, offset: number): Date {
  return addDays(weekStart, offset)
}

// ---------------------------------------------------------------------------
// Typed shift definition
// ---------------------------------------------------------------------------

type EmploymentType = "FULL_TIME" | "REDUCED_FULL_TIME" | "PART_TIME"

type ShiftDef = {
  id:           string
  employeeId:   string
  dayOffset:    number   // 0 = Mon … 6 = Sun
  startTime:    string   // "HH:MM"
  endTime:      string   // "HH:MM"
  breakMinutes: number
  jobRole:      string
  colorTag:     string
  notes:        string | null
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const w0   = currentMonday()
  const w1   = addDays(w0, -7)
  const w2   = addDays(w0, -14)
  const w3   = addDays(w0, -21)
  const w4   = addDays(w0, -28)
  const w_p1 = addDays(w0,  7)
  const w_p2 = addDays(w0,  14)
  const w_p3 = addDays(w0,  21)
  const w_p4 = addDays(w0,  28)
  const w_next = w_p1  // alias used by the availability request

  // Time-off request IDs
  const TOR = {
    lenaApproved:   "tor_lena_approved_001",
    tomDenied:      "tor_tom_denied_001",
    jamesPending:   "tor_james_pending_001",
    nadiaPending:   "tor_nadia_pending_001",
  }

  // Availability deadline: next Sunday 23:59 UTC
  const availDeadline = addDays(w_next, 6)
  availDeadline.setUTCHours(23, 59, 0, 0)

  // ── 1. Organization ────────────────────────────────────────────────────────
  console.log("1/10 Seeding organization…")

  await db.organization.upsert({
    where: { slug: "the-daily-grind" },
    create: {
      id:                 IDS.org,
      name:               "The Daily Grind",
      slug:               "the-daily-grind",
      subscriptionStatus: "ACTIVE",
    },
    update: {
      name:               "The Daily Grind",
      subscriptionStatus: "ACTIVE",
    },
  })

  // ── 2. Manager user + membership ──────────────────────────────────────────
  console.log("2/10 Seeding manager user…")

  // A generic "system manager" account — not tied to a real person
  await db.user.upsert({
    where: { id: IDS.userAlex },
    create: {
      id:    IDS.userAlex,
      name:  "Alex Manager",
      email: "manager@thedailygrind.com",
      role:  "MANAGER",
    },
    update: { name: "Alex Manager", email: "manager@thedailygrind.com", role: "MANAGER" },
  })

  await db.membership.upsert({
    where: { userId_organizationId: { userId: IDS.userAlex, organizationId: IDS.org } },
    create: {
      id:             IDS.memAlex,
      userId:         IDS.userAlex,
      organizationId: IDS.org,
      role:           "MANAGER",
    },
    update: { role: "MANAGER" },
  })

  // ── 3. Job roles ──────────────────────────────────────────────────────────
  console.log("3/10 Seeding job roles…")

  const JOB_ROLES = [
    { id: IDS.roleBarista,    name: "Barista",    color: "blue"   },
    { id: IDS.roleKitchen,    name: "Kitchen",    color: "orange" },
    { id: IDS.roleCashier,    name: "Cashier",    color: "green"  },
    { id: IDS.roleSupervisor, name: "Supervisor", color: "purple" },
    { id: IDS.roleServer,     name: "Server",     color: "yellow" },
  ] as const

  for (const role of JOB_ROLES) {
    await db.jobRole.upsert({
      where: { organizationId_name: { organizationId: IDS.org, name: role.name } },
      create: { id: role.id, organizationId: IDS.org, name: role.name, color: role.color },
      update: { color: role.color },
    })
  }

  // ── 4. Shift templates ────────────────────────────────────────────────────
  console.log("4/10 Seeding shift templates…")

  const SHIFT_TEMPLATES = [
    { id: IDS.tmplMorning,   name: "Morning",       startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "",          colorTag: null,     sortOrder: 0 },
    { id: IDS.tmplAfternoon, name: "Afternoon",     startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "",          colorTag: null,     sortOrder: 1 },
    { id: IDS.tmplEvening,   name: "Evening",       startTime: "15:00", endTime: "21:00", breakMinutes: 0,  jobRole: "",          colorTag: null,     sortOrder: 2 },
    { id: IDS.tmplKitchenAm, name: "Kitchen AM",    startTime: "07:00", endTime: "14:00", breakMinutes: 0,  jobRole: "Kitchen",   colorTag: "orange", sortOrder: 3 },
    { id: IDS.tmplKitchenPm, name: "Kitchen PM",    startTime: "13:00", endTime: "21:00", breakMinutes: 30, jobRole: "Kitchen",   colorTag: "orange", sortOrder: 4 },
    { id: IDS.tmplOpening,   name: "Opening Shift", startTime: "06:30", endTime: "14:00", breakMinutes: 0,  jobRole: "Supervisor",colorTag: "purple", sortOrder: 5 },
  ] as const

  for (const tmpl of SHIFT_TEMPLATES) {
    await db.shiftTemplate.upsert({
      where: { organizationId_name: { organizationId: IDS.org, name: tmpl.name } },
      create: { organizationId: IDS.org, ...tmpl },
      update: { startTime: tmpl.startTime, endTime: tmpl.endTime, breakMinutes: tmpl.breakMinutes, jobRole: tmpl.jobRole, colorTag: tmpl.colorTag, sortOrder: tmpl.sortOrder },
    })
  }

  // ── 5. Employees + user accounts ──────────────────────────────────────────
  console.log("5/10 Seeding employees + user accounts…")

  // Casper is the real admin — keep every field literal and stable
  const CASPER = {
    id:              IDS.empCasper,
    name:            "Casper Gamborg",
    email:           "gamborgc@gmail.com",
    phone:           "+4522583032",
    jobRole:         "Shift Supervisor",
    hourlyWage:      22.00,
    employmentType:  "FULL_TIME"          as EmploymentType,
    contractedHours: 40,
    notes:           null,
  }

  // The rest are fictional personas — all fields generated with Faker
  // faker.seed() at the top of the file keeps these stable across runs.
  const PERSONAS = [
    {
      id:              IDS.empSarah,
      name:            faker.person.fullName({ sex: "female", firstName: "Sarah", lastName: "Chen" }),
      email:           faker.internet.email({ firstName: "sarah", lastName: "chen", provider: "thedailygrind.com" }),
      phone:           faker.phone.number({ style: "international" }),
      jobRole:         "Barista",
      hourlyWage:      parseFloat(faker.finance.amount({ min: 13.5, max: 15.5, dec: 2 })),
      employmentType:  "FULL_TIME"         as EmploymentType,
      contractedHours: 40,
      notes:           faker.helpers.maybe(() => faker.lorem.sentence({ min: 5, max: 12 }), { probability: 0.3 }) ?? null,
    },
    {
      id:              IDS.empJames,
      name:            faker.person.fullName({ sex: "male", firstName: "James", lastName: "O'Brien" }),
      email:           faker.internet.email({ firstName: "james", lastName: "obrien", provider: "thedailygrind.com" }),
      phone:           faker.phone.number({ style: "international" }),
      jobRole:         "Barista",
      hourlyWage:      parseFloat(faker.finance.amount({ min: 12.5, max: 14.0, dec: 2 })),
      employmentType:  "PART_TIME"         as EmploymentType,
      contractedHours: 20,
      notes:           faker.helpers.maybe(() => faker.lorem.sentence({ min: 5, max: 12 }), { probability: 0.3 }) ?? null,
    },
    {
      id:              IDS.empMia,
      name:            faker.person.fullName({ sex: "female", firstName: "Mia", lastName: "Andersen" }),
      email:           faker.internet.email({ firstName: "mia", lastName: "andersen", provider: "thedailygrind.com" }),
      phone:           faker.phone.number({ style: "international" }),
      jobRole:         "Cashier",
      hourlyWage:      parseFloat(faker.finance.amount({ min: 12.0, max: 13.5, dec: 2 })),
      employmentType:  "PART_TIME"         as EmploymentType,
      contractedHours: 24,
      notes:           faker.helpers.maybe(() => faker.lorem.sentence({ min: 5, max: 12 }), { probability: 0.3 }) ?? null,
    },
    {
      id:              IDS.empTom,
      name:            faker.person.fullName({ sex: "male", firstName: "Tom", lastName: "Eriksson" }),
      email:           faker.internet.email({ firstName: "tom", lastName: "eriksson", provider: "thedailygrind.com" }),
      phone:           faker.phone.number({ style: "international" }),
      jobRole:         "Kitchen",
      hourlyWage:      parseFloat(faker.finance.amount({ min: 13.0, max: 15.0, dec: 2 })),
      employmentType:  "FULL_TIME"         as EmploymentType,
      contractedHours: 40,
      notes:           faker.helpers.maybe(() => faker.lorem.sentence({ min: 5, max: 12 }), { probability: 0.3 }) ?? null,
    },
    {
      id:              IDS.empLena,
      name:            faker.person.fullName({ sex: "female", firstName: "Lena", lastName: "Schmidt" }),
      email:           faker.internet.email({ firstName: "lena", lastName: "schmidt", provider: "thedailygrind.com" }),
      phone:           faker.phone.number({ style: "international" }),
      jobRole:         "Shift Supervisor",
      hourlyWage:      parseFloat(faker.finance.amount({ min: 15.5, max: 18.0, dec: 2 })),
      employmentType:  "REDUCED_FULL_TIME" as EmploymentType,
      contractedHours: 32,
      notes:           faker.helpers.maybe(() => faker.lorem.sentence({ min: 5, max: 12 }), { probability: 0.3 }) ?? null,
    },
    {
      id:              IDS.empNadia,
      name:            faker.person.fullName({ sex: "female", firstName: "Nadia", lastName: "Patel" }),
      email:           faker.internet.email({ firstName: "nadia", lastName: "patel", provider: "thedailygrind.com" }),
      phone:           faker.phone.number({ style: "international" }),
      jobRole:         "Barista",
      hourlyWage:      parseFloat(faker.finance.amount({ min: 12.5, max: 14.0, dec: 2 })),
      employmentType:  "PART_TIME"         as EmploymentType,
      contractedHours: 16,
      notes:           faker.helpers.maybe(() => faker.lorem.sentence({ min: 5, max: 12 }), { probability: 0.3 }) ?? null,
    },
  ]

  const ALL_EMPLOYEES = [CASPER, ...PERSONAS]

  // Pairs each employee with a stable user ID, membership ID, and roles
  const EMP_USER_LINKS = [
    { emp: CASPER,      userId: IDS.userCasper, memId: IDS.memCasper, userRole: "ADMIN"    as const, memRole: "MANAGER"  as const },
    { emp: PERSONAS[0], userId: IDS.userSarah,  memId: IDS.memSarah,  userRole: "EMPLOYEE" as const, memRole: "EMPLOYEE" as const },
    { emp: PERSONAS[1], userId: IDS.userJames,  memId: IDS.memJames,  userRole: "EMPLOYEE" as const, memRole: "EMPLOYEE" as const },
    { emp: PERSONAS[2], userId: IDS.userMia,    memId: IDS.memMia,    userRole: "EMPLOYEE" as const, memRole: "EMPLOYEE" as const },
    { emp: PERSONAS[3], userId: IDS.userTom,    memId: IDS.memTom,    userRole: "EMPLOYEE" as const, memRole: "EMPLOYEE" as const },
    { emp: PERSONAS[4], userId: IDS.userLena,   memId: IDS.memLena,   userRole: "EMPLOYEE" as const, memRole: "EMPLOYEE" as const },
    { emp: PERSONAS[5], userId: IDS.userNadia,  memId: IDS.memNadia,  userRole: "EMPLOYEE" as const, memRole: "EMPLOYEE" as const },
  ]

  for (const emp of ALL_EMPLOYEES) {
    await db.employee.upsert({
      where: { id: emp.id },
      create: {
        id:              emp.id,
        organizationId:  IDS.org,
        name:            emp.name,
        email:           emp.email,
        phone:           emp.phone ?? null,
        jobRole:         emp.jobRole,
        hourlyWage:      emp.hourlyWage,
        employmentType:  emp.employmentType,
        contractedHours: emp.contractedHours,
        notes:           emp.notes,
        isActive:        true,
      },
      update: {
        name:            emp.name,
        email:           emp.email,
        phone:           emp.phone ?? null,
        jobRole:         emp.jobRole,
        hourlyWage:      emp.hourlyWage,
        employmentType:  emp.employmentType,
        contractedHours: emp.contractedHours,
        notes:           emp.notes,
        isActive:        true,
      },
    })
  }

  // Create a User + Membership for every employee so each worker can sign in.
  // A user may already exist (e.g. created by NextAuth on first sign-in) with a
  // different ID — find by email first and reuse that ID.
  for (const { emp, userId: stableId, memId, userRole, memRole } of EMP_USER_LINKS) {
    const existing = await db.user.findFirst({ where: { email: emp.email } })
    const resolvedUserId = existing?.id ?? stableId

    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data:  { name: emp.name, role: userRole },
      })
    } else {
      await db.user.create({
        data: { id: stableId, name: emp.name, email: emp.email, role: userRole },
      })
    }

    await db.membership.upsert({
      where:  { userId_organizationId: { userId: resolvedUserId, organizationId: IDS.org } },
      create: { id: memId, userId: resolvedUserId, organizationId: IDS.org, role: memRole },
      update: { role: memRole },
    })

    await db.employee.update({
      where: { id: emp.id },
      data:  { userId: resolvedUserId },
    })

    console.log(`     → ${emp.name} (${emp.email})`)
  }

  // ── 6. Schedules ──────────────────────────────────────────────────────────
  console.log("6/10 Seeding schedules…")

  // Delete stale schedules (and their shifts via cascade) so stable IDs can be reassigned to current dates
  await db.schedule.deleteMany({ where: { organizationId: IDS.org } })

  const SCHEDULES = [
    { id: IDS.schedW4,  weekStart: w4   },
    { id: IDS.schedW3,  weekStart: w3   },
    { id: IDS.schedW2,  weekStart: w2   },
    { id: IDS.schedW1,  weekStart: w1   },
    { id: IDS.schedW0,  weekStart: w0   },
    { id: IDS.schedWp1, weekStart: w_p1 },
    { id: IDS.schedWp2, weekStart: w_p2 },
    { id: IDS.schedWp3, weekStart: w_p3 },
    { id: IDS.schedWp4, weekStart: w_p4 },
  ]

  await db.schedule.createMany({
    data: SCHEDULES.map(({ id, weekStart }) => ({
      id, organizationId: IDS.org, weekStart, isDuplicate: false,
    })),
  })

  // ── 7. Shifts ─────────────────────────────────────────────────────────────
  console.log("7/10 Seeding shifts…")

  // Realistic shift notes for a coffee shop — drawn deterministically via faker
  const shiftNotes = {
    supervisorOpening:   "Opening supervisor on duty — keys with manager.",
    supervisorFloor:     "Floor manager today. Brief the team at 09:30.",
    supervisorWeekend:   "Weekend rush supervisor — extra till cover needed.",
    baristaRush:         "Morning rush cover — extra shot of patience required.",
    baristaClose:        "Close the espresso machine, clean steam wands.",
    kitchenPrep:         "Prep for lunch service starts at 10:00.",
    kitchenClose:        "Deep-clean ovens and fridges before leaving.",
    coverNote:           "Covering for a colleague — check the rota board.",
    holidayReturn:       "Back from holiday — review this week's menu changes.",
    stockCheck:          "Pre-weekend stock check with delivery at 08:00.",
    trainingNote:        "New menu item training during first hour.",
    quietShift:          "Quieter shift — restock and label prep items.",
  }

  // Helper: pick a note or null with a given probability
  function maybeNote(note: string, probability = 0.5): string | null {
    return faker.helpers.maybe(() => note, { probability }) ?? null
  }

  // Each array represents one schedule week.
  // dayOffset: 0=Mon 1=Tue 2=Wed 3=Thu 4=Fri 5=Sat
  const shiftsBySchedule: Record<string, ShiftDef[]> = {

    // ── W0: current week ─────────────────────────────────────────────────────
    [IDS.schedW0]: [
      // Monday
      { id: "sh_w0_mon_casper", employeeId: IDS.empCasper, dayOffset: 0, startTime: "10:00", endTime: "18:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.supervisorFloor },
      { id: "sh_w0_mon_lena",   employeeId: IDS.empLena,   dayOffset: 0, startTime: "06:30", endTime: "14:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.supervisorOpening },
      { id: "sh_w0_mon_sarah",  employeeId: IDS.empSarah,  dayOffset: 0, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w0_mon_tom",    employeeId: IDS.empTom,    dayOffset: 0, startTime: "09:00", endTime: "15:00", breakMinutes:  0, jobRole: "Kitchen",    colorTag: "orange", notes: maybeNote(shiftNotes.kitchenPrep) },
      // Tuesday
      { id: "sh_w0_tue_sarah",  employeeId: IDS.empSarah,  dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w0_tue_mia",    employeeId: IDS.empMia,    dayOffset: 1, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_w0_tue_tom",    employeeId: IDS.empTom,    dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Wednesday
      { id: "sh_w0_wed_casper", employeeId: IDS.empCasper, dayOffset: 2, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_w0_wed_lena",   employeeId: IDS.empLena,   dayOffset: 2, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_w0_wed_james",  employeeId: IDS.empJames,  dayOffset: 2, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w0_wed_nadia",  employeeId: IDS.empNadia,  dayOffset: 2, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w0_wed_mia",    employeeId: IDS.empMia,    dayOffset: 2, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Cashier",    colorTag: "green",  notes: null },
      // Thursday
      { id: "sh_w0_thu_sarah",  employeeId: IDS.empSarah,  dayOffset: 3, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w0_thu_tom",    employeeId: IDS.empTom,    dayOffset: 3, startTime: "10:00", endTime: "18:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_w0_thu_mia",    employeeId: IDS.empMia,    dayOffset: 3, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_w0_thu_nadia",  employeeId: IDS.empNadia,  dayOffset: 3, startTime: "14:00", endTime: "20:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: null },
      // Friday
      { id: "sh_w0_fri_casper", employeeId: IDS.empCasper, dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.stockCheck },
      { id: "sh_w0_fri_lena",   employeeId: IDS.empLena,   dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: maybeNote(shiftNotes.supervisorFloor) },
      { id: "sh_w0_fri_sarah",  employeeId: IDS.empSarah,  dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w0_fri_nadia",  employeeId: IDS.empNadia,  dayOffset: 4, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaRush },
      { id: "sh_w0_fri_tom",    employeeId: IDS.empTom,    dayOffset: 4, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_w0_fri_mia",    employeeId: IDS.empMia,    dayOffset: 4, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_w0_fri_james",  employeeId: IDS.empJames,  dayOffset: 4, startTime: "14:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
      // Saturday
      { id: "sh_w0_sat_lena",   employeeId: IDS.empLena,   dayOffset: 5, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.supervisorWeekend },
      { id: "sh_w0_sat_sarah",  employeeId: IDS.empSarah,  dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w0_sat_nadia",  employeeId: IDS.empNadia,  dayOffset: 5, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w0_sat_tom",    employeeId: IDS.empTom,    dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_w0_sat_james",  employeeId: IDS.empJames,  dayOffset: 5, startTime: "15:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
    ],

    // ── W1: last week — Lena on holiday Mon–Wed; James covers extra ──────────
    [IDS.schedW1]: [
      // Monday
      { id: "sh_w1_mon_sarah",  employeeId: IDS.empSarah,  dayOffset: 0, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w1_mon_james",  employeeId: IDS.empJames,  dayOffset: 0, startTime: "07:00", endTime: "14:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.coverNote },
      { id: "sh_w1_mon_tom",    employeeId: IDS.empTom,    dayOffset: 0, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Tuesday
      { id: "sh_w1_tue_sarah",  employeeId: IDS.empSarah,  dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w1_tue_nadia",  employeeId: IDS.empNadia,  dayOffset: 1, startTime: "08:00", endTime: "14:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w1_tue_tom",    employeeId: IDS.empTom,    dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Wednesday
      { id: "sh_w1_wed_sarah",  employeeId: IDS.empSarah,  dayOffset: 2, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w1_wed_james",  employeeId: IDS.empJames,  dayOffset: 2, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w1_wed_nadia",  employeeId: IDS.empNadia,  dayOffset: 2, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w1_wed_mia",    employeeId: IDS.empMia,    dayOffset: 2, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Cashier",    colorTag: "green",  notes: null },
      // Thursday (Lena returns)
      { id: "sh_w1_thu_lena",   employeeId: IDS.empLena,   dayOffset: 3, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.holidayReturn },
      { id: "sh_w1_thu_sarah",  employeeId: IDS.empSarah,  dayOffset: 3, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w1_thu_tom",    employeeId: IDS.empTom,    dayOffset: 3, startTime: "10:00", endTime: "18:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_w1_thu_mia",    employeeId: IDS.empMia,    dayOffset: 3, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      // Friday
      { id: "sh_w1_fri_lena",   employeeId: IDS.empLena,   dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_w1_fri_sarah",  employeeId: IDS.empSarah,  dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w1_fri_nadia",  employeeId: IDS.empNadia,  dayOffset: 4, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w1_fri_tom",    employeeId: IDS.empTom,    dayOffset: 4, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_w1_fri_mia",    employeeId: IDS.empMia,    dayOffset: 4, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_w1_fri_james",  employeeId: IDS.empJames,  dayOffset: 4, startTime: "14:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
      // Saturday
      { id: "sh_w1_sat_lena",   employeeId: IDS.empLena,   dayOffset: 5, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_w1_sat_sarah",  employeeId: IDS.empSarah,  dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w1_sat_nadia",  employeeId: IDS.empNadia,  dayOffset: 5, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w1_sat_tom",    employeeId: IDS.empTom,    dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_w1_sat_james",  employeeId: IDS.empJames,  dayOffset: 5, startTime: "15:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
    ],

    // ── W2: two weeks ago — quieter week, Nadia starts Thu ───────────────────
    [IDS.schedW2]: [
      // Monday
      { id: "sh_w2_mon_lena",   employeeId: IDS.empLena,   dayOffset: 0, startTime: "08:00", endTime: "14:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_w2_mon_sarah",  employeeId: IDS.empSarah,  dayOffset: 0, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w2_mon_tom",    employeeId: IDS.empTom,    dayOffset: 0, startTime: "09:00", endTime: "15:00", breakMinutes:  0, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Tuesday
      { id: "sh_w2_tue_sarah",  employeeId: IDS.empSarah,  dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w2_tue_mia",    employeeId: IDS.empMia,    dayOffset: 1, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_w2_tue_tom",    employeeId: IDS.empTom,    dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Wednesday
      { id: "sh_w2_wed_lena",   employeeId: IDS.empLena,   dayOffset: 2, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_w2_wed_james",  employeeId: IDS.empJames,  dayOffset: 2, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w2_wed_mia",    employeeId: IDS.empMia,    dayOffset: 2, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_w2_wed_tom",    employeeId: IDS.empTom,    dayOffset: 2, startTime: "10:00", endTime: "16:00", breakMinutes:  0, jobRole: "Kitchen",    colorTag: "orange", notes: maybeNote(shiftNotes.quietShift) },
      // Thursday
      { id: "sh_w2_thu_sarah",  employeeId: IDS.empSarah,  dayOffset: 3, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w2_thu_nadia",  employeeId: IDS.empNadia,  dayOffset: 3, startTime: "12:00", endTime: "20:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w2_thu_tom",    employeeId: IDS.empTom,    dayOffset: 3, startTime: "10:00", endTime: "18:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_w2_thu_mia",    employeeId: IDS.empMia,    dayOffset: 3, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Cashier",    colorTag: "green",  notes: null },
      // Friday
      { id: "sh_w2_fri_lena",   employeeId: IDS.empLena,   dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_w2_fri_sarah",  employeeId: IDS.empSarah,  dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w2_fri_nadia",  employeeId: IDS.empNadia,  dayOffset: 4, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w2_fri_tom",    employeeId: IDS.empTom,    dayOffset: 4, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_w2_fri_mia",    employeeId: IDS.empMia,    dayOffset: 4, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_w2_fri_james",  employeeId: IDS.empJames,  dayOffset: 4, startTime: "14:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
      // Saturday
      { id: "sh_w2_sat_lena",   employeeId: IDS.empLena,   dayOffset: 5, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_w2_sat_sarah",  employeeId: IDS.empSarah,  dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w2_sat_nadia",  employeeId: IDS.empNadia,  dayOffset: 5, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w2_sat_tom",    employeeId: IDS.empTom,    dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_w2_sat_james",  employeeId: IDS.empJames,  dayOffset: 5, startTime: "15:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
    ],

    // ── W3: three weeks ago — Tom sick Mon–Tue, James covers kitchen ─────────
    [IDS.schedW3]: [
      // Monday (Tom sick)
      { id: "sh_w3_mon_lena",   employeeId: IDS.empLena,   dayOffset: 0, startTime: "08:00", endTime: "14:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_w3_mon_sarah",  employeeId: IDS.empSarah,  dayOffset: 0, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w3_mon_james",  employeeId: IDS.empJames,  dayOffset: 0, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: shiftNotes.coverNote },
      // Tuesday (Tom still sick)
      { id: "sh_w3_tue_sarah",  employeeId: IDS.empSarah,  dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w3_tue_nadia",  employeeId: IDS.empNadia,  dayOffset: 1, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w3_tue_mia",    employeeId: IDS.empMia,    dayOffset: 1, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      // Wednesday
      { id: "sh_w3_wed_lena",   employeeId: IDS.empLena,   dayOffset: 2, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_w3_wed_james",  employeeId: IDS.empJames,  dayOffset: 2, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w3_wed_nadia",  employeeId: IDS.empNadia,  dayOffset: 2, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w3_wed_mia",    employeeId: IDS.empMia,    dayOffset: 2, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Cashier",    colorTag: "green",  notes: null },
      // Thursday (Tom returns)
      { id: "sh_w3_thu_sarah",  employeeId: IDS.empSarah,  dayOffset: 3, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w3_thu_tom",    employeeId: IDS.empTom,    dayOffset: 3, startTime: "10:00", endTime: "18:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: "Back from sick leave — light duties today." },
      { id: "sh_w3_thu_mia",    employeeId: IDS.empMia,    dayOffset: 3, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_w3_thu_nadia",  employeeId: IDS.empNadia,  dayOffset: 3, startTime: "14:00", endTime: "20:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: null },
      // Friday
      { id: "sh_w3_fri_lena",   employeeId: IDS.empLena,   dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_w3_fri_sarah",  employeeId: IDS.empSarah,  dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w3_fri_nadia",  employeeId: IDS.empNadia,  dayOffset: 4, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w3_fri_tom",    employeeId: IDS.empTom,    dayOffset: 4, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_w3_fri_mia",    employeeId: IDS.empMia,    dayOffset: 4, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_w3_fri_james",  employeeId: IDS.empJames,  dayOffset: 4, startTime: "14:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
      // Saturday
      { id: "sh_w3_sat_lena",   employeeId: IDS.empLena,   dayOffset: 5, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.supervisorWeekend },
      { id: "sh_w3_sat_sarah",  employeeId: IDS.empSarah,  dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w3_sat_nadia",  employeeId: IDS.empNadia,  dayOffset: 5, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w3_sat_tom",    employeeId: IDS.empTom,    dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_w3_sat_james",  employeeId: IDS.empJames,  dayOffset: 5, startTime: "15:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
    ],

    // ── W4: four weeks ago — reduced staffing, Mia on shorter hours ──────────
    [IDS.schedW4]: [
      // Monday
      { id: "sh_w4_mon_lena",   employeeId: IDS.empLena,   dayOffset: 0, startTime: "08:00", endTime: "14:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_w4_mon_sarah",  employeeId: IDS.empSarah,  dayOffset: 0, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w4_mon_tom",    employeeId: IDS.empTom,    dayOffset: 0, startTime: "09:00", endTime: "15:00", breakMinutes:  0, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Tuesday
      { id: "sh_w4_tue_sarah",  employeeId: IDS.empSarah,  dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w4_tue_mia",    employeeId: IDS.empMia,    dayOffset: 1, startTime: "10:00", endTime: "14:00", breakMinutes:  0, jobRole: "Cashier",    colorTag: "green",  notes: "Reduced hours this week." },
      { id: "sh_w4_tue_tom",    employeeId: IDS.empTom,    dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Wednesday
      { id: "sh_w4_wed_lena",   employeeId: IDS.empLena,   dayOffset: 2, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_w4_wed_james",  employeeId: IDS.empJames,  dayOffset: 2, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w4_wed_nadia",  employeeId: IDS.empNadia,  dayOffset: 2, startTime: "11:00", endTime: "17:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w4_wed_tom",    employeeId: IDS.empTom,    dayOffset: 2, startTime: "10:00", endTime: "16:00", breakMinutes:  0, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Thursday
      { id: "sh_w4_thu_lena",   employeeId: IDS.empLena,   dayOffset: 3, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: maybeNote(shiftNotes.trainingNote) },
      { id: "sh_w4_thu_sarah",  employeeId: IDS.empSarah,  dayOffset: 3, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w4_thu_mia",    employeeId: IDS.empMia,    dayOffset: 3, startTime: "10:00", endTime: "14:00", breakMinutes:  0, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_w4_thu_tom",    employeeId: IDS.empTom,    dayOffset: 3, startTime: "10:00", endTime: "18:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Friday
      { id: "sh_w4_fri_lena",   employeeId: IDS.empLena,   dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_w4_fri_sarah",  employeeId: IDS.empSarah,  dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w4_fri_nadia",  employeeId: IDS.empNadia,  dayOffset: 4, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w4_fri_tom",    employeeId: IDS.empTom,    dayOffset: 4, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_w4_fri_mia",    employeeId: IDS.empMia,    dayOffset: 4, startTime: "12:00", endTime: "18:00", breakMinutes:  0, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_w4_fri_james",  employeeId: IDS.empJames,  dayOffset: 4, startTime: "14:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
      // Saturday
      { id: "sh_w4_sat_lena",   employeeId: IDS.empLena,   dayOffset: 5, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_w4_sat_sarah",  employeeId: IDS.empSarah,  dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w4_sat_nadia",  employeeId: IDS.empNadia,  dayOffset: 5, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_w4_sat_tom",    employeeId: IDS.empTom,    dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_w4_sat_james",  employeeId: IDS.empJames,  dayOffset: 5, startTime: "15:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
    ],

    // ── W+1: next week — availability request open; Lena briefing Wed ────────
    [IDS.schedWp1]: [
      // Monday
      { id: "sh_wp1_mon_casper", employeeId: IDS.empCasper, dayOffset: 0, startTime: "10:00", endTime: "18:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.supervisorFloor },
      { id: "sh_wp1_mon_lena",   employeeId: IDS.empLena,   dayOffset: 0, startTime: "06:30", endTime: "14:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.supervisorOpening },
      { id: "sh_wp1_mon_sarah",  employeeId: IDS.empSarah,  dayOffset: 0, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp1_mon_tom",    employeeId: IDS.empTom,    dayOffset: 0, startTime: "09:00", endTime: "15:00", breakMinutes:  0, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Tuesday
      { id: "sh_wp1_tue_sarah",  employeeId: IDS.empSarah,  dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp1_tue_nadia",  employeeId: IDS.empNadia,  dayOffset: 1, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp1_tue_mia",    employeeId: IDS.empMia,    dayOffset: 1, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_wp1_tue_tom",    employeeId: IDS.empTom,    dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Wednesday — new menu briefing with Lena
      { id: "sh_wp1_wed_casper", employeeId: IDS.empCasper, dayOffset: 2, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_wp1_wed_lena",   employeeId: IDS.empLena,   dayOffset: 2, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.trainingNote },
      { id: "sh_wp1_wed_james",  employeeId: IDS.empJames,  dayOffset: 2, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp1_wed_mia",    employeeId: IDS.empMia,    dayOffset: 2, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Cashier",    colorTag: "green",  notes: null },
      // Thursday
      { id: "sh_wp1_thu_sarah",  employeeId: IDS.empSarah,  dayOffset: 3, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp1_thu_nadia",  employeeId: IDS.empNadia,  dayOffset: 3, startTime: "14:00", endTime: "20:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp1_thu_tom",    employeeId: IDS.empTom,    dayOffset: 3, startTime: "10:00", endTime: "18:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_wp1_thu_mia",    employeeId: IDS.empMia,    dayOffset: 3, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      // Friday
      { id: "sh_wp1_fri_casper", employeeId: IDS.empCasper, dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.stockCheck },
      { id: "sh_wp1_fri_lena",   employeeId: IDS.empLena,   dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_wp1_fri_sarah",  employeeId: IDS.empSarah,  dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp1_fri_nadia",  employeeId: IDS.empNadia,  dayOffset: 4, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp1_fri_tom",    employeeId: IDS.empTom,    dayOffset: 4, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_wp1_fri_mia",    employeeId: IDS.empMia,    dayOffset: 4, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_wp1_fri_james",  employeeId: IDS.empJames,  dayOffset: 4, startTime: "14:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
      // Saturday
      { id: "sh_wp1_sat_lena",   employeeId: IDS.empLena,   dayOffset: 5, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.supervisorWeekend },
      { id: "sh_wp1_sat_sarah",  employeeId: IDS.empSarah,  dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp1_sat_nadia",  employeeId: IDS.empNadia,  dayOffset: 5, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp1_sat_tom",    employeeId: IDS.empTom,    dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_wp1_sat_james",  employeeId: IDS.empJames,  dayOffset: 5, startTime: "15:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
    ],

    // ── W+2: Sarah on holiday Thu–Sat; Nadia and James cover ─────────────────
    [IDS.schedWp2]: [
      // Monday
      { id: "sh_wp2_mon_casper", employeeId: IDS.empCasper, dayOffset: 0, startTime: "10:00", endTime: "18:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.supervisorFloor },
      { id: "sh_wp2_mon_lena",   employeeId: IDS.empLena,   dayOffset: 0, startTime: "06:30", endTime: "14:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.supervisorOpening },
      { id: "sh_wp2_mon_sarah",  employeeId: IDS.empSarah,  dayOffset: 0, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp2_mon_tom",    employeeId: IDS.empTom,    dayOffset: 0, startTime: "09:00", endTime: "15:00", breakMinutes:  0, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Tuesday
      { id: "sh_wp2_tue_sarah",  employeeId: IDS.empSarah,  dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp2_tue_nadia",  employeeId: IDS.empNadia,  dayOffset: 1, startTime: "08:00", endTime: "14:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp2_tue_mia",    employeeId: IDS.empMia,    dayOffset: 1, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_wp2_tue_tom",    employeeId: IDS.empTom,    dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Wednesday
      { id: "sh_wp2_wed_lena",   employeeId: IDS.empLena,   dayOffset: 2, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_wp2_wed_sarah",  employeeId: IDS.empSarah,  dayOffset: 2, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp2_wed_james",  employeeId: IDS.empJames,  dayOffset: 2, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp2_wed_mia",    employeeId: IDS.empMia,    dayOffset: 2, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Cashier",    colorTag: "green",  notes: null },
      // Thursday (Sarah on holiday — Nadia + James cover)
      { id: "sh_wp2_thu_nadia",  employeeId: IDS.empNadia,  dayOffset: 3, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.coverNote },
      { id: "sh_wp2_thu_james",  employeeId: IDS.empJames,  dayOffset: 3, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.coverNote },
      { id: "sh_wp2_thu_tom",    employeeId: IDS.empTom,    dayOffset: 3, startTime: "10:00", endTime: "18:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_wp2_thu_mia",    employeeId: IDS.empMia,    dayOffset: 3, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      // Friday (Sarah still on holiday)
      { id: "sh_wp2_fri_casper", employeeId: IDS.empCasper, dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_wp2_fri_lena",   employeeId: IDS.empLena,   dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_wp2_fri_nadia",  employeeId: IDS.empNadia,  dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp2_fri_james",  employeeId: IDS.empJames,  dayOffset: 4, startTime: "14:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
      { id: "sh_wp2_fri_tom",    employeeId: IDS.empTom,    dayOffset: 4, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_wp2_fri_mia",    employeeId: IDS.empMia,    dayOffset: 4, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      // Saturday (Sarah still on holiday)
      { id: "sh_wp2_sat_lena",   employeeId: IDS.empLena,   dayOffset: 5, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.supervisorWeekend },
      { id: "sh_wp2_sat_nadia",  employeeId: IDS.empNadia,  dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp2_sat_james",  employeeId: IDS.empJames,  dayOffset: 5, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp2_sat_tom",    employeeId: IDS.empTom,    dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
    ],

    // ── W+3: quiet week — stock delivery + deep clean Monday ─────────────────
    [IDS.schedWp3]: [
      // Monday — delivery + deep clean
      { id: "sh_wp3_mon_casper", employeeId: IDS.empCasper, dayOffset: 0, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.stockCheck },
      { id: "sh_wp3_mon_lena",   employeeId: IDS.empLena,   dayOffset: 0, startTime: "06:30", endTime: "14:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.supervisorOpening },
      { id: "sh_wp3_mon_sarah",  employeeId: IDS.empSarah,  dayOffset: 0, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp3_mon_tom",    employeeId: IDS.empTom,    dayOffset: 0, startTime: "09:00", endTime: "15:00", breakMinutes:  0, jobRole: "Kitchen",    colorTag: "orange", notes: shiftNotes.kitchenPrep },
      // Tuesday
      { id: "sh_wp3_tue_sarah",  employeeId: IDS.empSarah,  dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp3_tue_nadia",  employeeId: IDS.empNadia,  dayOffset: 1, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp3_tue_mia",    employeeId: IDS.empMia,    dayOffset: 1, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_wp3_tue_tom",    employeeId: IDS.empTom,    dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Wednesday
      { id: "sh_wp3_wed_casper", employeeId: IDS.empCasper, dayOffset: 2, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_wp3_wed_lena",   employeeId: IDS.empLena,   dayOffset: 2, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_wp3_wed_james",  employeeId: IDS.empJames,  dayOffset: 2, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp3_wed_nadia",  employeeId: IDS.empNadia,  dayOffset: 2, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp3_wed_mia",    employeeId: IDS.empMia,    dayOffset: 2, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Cashier",    colorTag: "green",  notes: null },
      // Thursday
      { id: "sh_wp3_thu_sarah",  employeeId: IDS.empSarah,  dayOffset: 3, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp3_thu_tom",    employeeId: IDS.empTom,    dayOffset: 3, startTime: "10:00", endTime: "18:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_wp3_thu_mia",    employeeId: IDS.empMia,    dayOffset: 3, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_wp3_thu_nadia",  employeeId: IDS.empNadia,  dayOffset: 3, startTime: "14:00", endTime: "20:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: null },
      // Friday
      { id: "sh_wp3_fri_casper", employeeId: IDS.empCasper, dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_wp3_fri_lena",   employeeId: IDS.empLena,   dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: maybeNote(shiftNotes.supervisorFloor) },
      { id: "sh_wp3_fri_sarah",  employeeId: IDS.empSarah,  dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp3_fri_nadia",  employeeId: IDS.empNadia,  dayOffset: 4, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp3_fri_tom",    employeeId: IDS.empTom,    dayOffset: 4, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: shiftNotes.kitchenClose },
      { id: "sh_wp3_fri_mia",    employeeId: IDS.empMia,    dayOffset: 4, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_wp3_fri_james",  employeeId: IDS.empJames,  dayOffset: 4, startTime: "14:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
      // Saturday
      { id: "sh_wp3_sat_lena",   employeeId: IDS.empLena,   dayOffset: 5, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_wp3_sat_sarah",  employeeId: IDS.empSarah,  dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp3_sat_nadia",  employeeId: IDS.empNadia,  dayOffset: 5, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp3_sat_tom",    employeeId: IDS.empTom,    dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_wp3_sat_james",  employeeId: IDS.empJames,  dayOffset: 5, startTime: "15:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
    ],

    // ── W+4: full-team week — all hands, extra Saturday coverage ─────────────
    [IDS.schedWp4]: [
      // Monday
      { id: "sh_wp4_mon_casper", employeeId: IDS.empCasper, dayOffset: 0, startTime: "10:00", endTime: "18:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.supervisorFloor },
      { id: "sh_wp4_mon_lena",   employeeId: IDS.empLena,   dayOffset: 0, startTime: "06:30", endTime: "14:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.supervisorOpening },
      { id: "sh_wp4_mon_sarah",  employeeId: IDS.empSarah,  dayOffset: 0, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp4_mon_tom",    employeeId: IDS.empTom,    dayOffset: 0, startTime: "09:00", endTime: "15:00", breakMinutes:  0, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Tuesday
      { id: "sh_wp4_tue_sarah",  employeeId: IDS.empSarah,  dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp4_tue_nadia",  employeeId: IDS.empNadia,  dayOffset: 1, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp4_tue_mia",    employeeId: IDS.empMia,    dayOffset: 1, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_wp4_tue_tom",    employeeId: IDS.empTom,    dayOffset: 1, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      // Wednesday
      { id: "sh_wp4_wed_casper", employeeId: IDS.empCasper, dayOffset: 2, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_wp4_wed_lena",   employeeId: IDS.empLena,   dayOffset: 2, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_wp4_wed_james",  employeeId: IDS.empJames,  dayOffset: 2, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp4_wed_nadia",  employeeId: IDS.empNadia,  dayOffset: 2, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp4_wed_mia",    employeeId: IDS.empMia,    dayOffset: 2, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Cashier",    colorTag: "green",  notes: null },
      // Thursday
      { id: "sh_wp4_thu_sarah",  employeeId: IDS.empSarah,  dayOffset: 3, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp4_thu_nadia",  employeeId: IDS.empNadia,  dayOffset: 3, startTime: "14:00", endTime: "20:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp4_thu_tom",    employeeId: IDS.empTom,    dayOffset: 3, startTime: "10:00", endTime: "18:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_wp4_thu_mia",    employeeId: IDS.empMia,    dayOffset: 3, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      // Friday
      { id: "sh_wp4_fri_casper", employeeId: IDS.empCasper, dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.stockCheck },
      { id: "sh_wp4_fri_lena",   employeeId: IDS.empLena,   dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_wp4_fri_sarah",  employeeId: IDS.empSarah,  dayOffset: 4, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp4_fri_nadia",  employeeId: IDS.empNadia,  dayOffset: 4, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaRush },
      { id: "sh_wp4_fri_tom",    employeeId: IDS.empTom,    dayOffset: 4, startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_wp4_fri_mia",    employeeId: IDS.empMia,    dayOffset: 4, startTime: "11:00", endTime: "19:00", breakMinutes: 30, jobRole: "Cashier",    colorTag: "green",  notes: null },
      { id: "sh_wp4_fri_james",  employeeId: IDS.empJames,  dayOffset: 4, startTime: "14:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
      // Saturday — extra coverage
      { id: "sh_wp4_sat_casper", employeeId: IDS.empCasper, dayOffset: 5, startTime: "08:00", endTime: "14:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: shiftNotes.supervisorWeekend },
      { id: "sh_wp4_sat_lena",   employeeId: IDS.empLena,   dayOffset: 5, startTime: "07:00", endTime: "13:00", breakMinutes:  0, jobRole: "Supervisor", colorTag: "purple", notes: null },
      { id: "sh_wp4_sat_sarah",  employeeId: IDS.empSarah,  dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp4_sat_nadia",  employeeId: IDS.empNadia,  dayOffset: 5, startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Barista",    colorTag: "blue",   notes: null },
      { id: "sh_wp4_sat_tom",    employeeId: IDS.empTom,    dayOffset: 5, startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen",    colorTag: "orange", notes: null },
      { id: "sh_wp4_sat_james",  employeeId: IDS.empJames,  dayOffset: 5, startTime: "15:00", endTime: "21:00", breakMinutes:  0, jobRole: "Barista",    colorTag: "blue",   notes: shiftNotes.baristaClose },
    ],
  }

  // Delete all existing shifts for the org, then recreate cleanly
  await db.shift.deleteMany({ where: { organizationId: IDS.org } })

  for (const { id: scheduleId, weekStart } of SCHEDULES) {
    const defs = shiftsBySchedule[scheduleId]
    await db.shift.createMany({
      data: defs.map((s) => ({
        id:             s.id,
        scheduleId,
        organizationId: IDS.org,
        employeeId:     s.employeeId,
        date:           weekDay(weekStart, s.dayOffset),
        startTime:      s.startTime,
        endTime:        s.endTime,
        breakMinutes:   s.breakMinutes,
        jobRole:        s.jobRole,
        colorTag:       s.colorTag,
        notes:          s.notes,
      })),
    })
    console.log(`     → ${defs.length} shifts created for schedule ${scheduleId}`)
  }

  // ── 8. Availability request + submissions ─────────────────────────────────
  console.log("8/10 Seeding availability…")

  await db.availabilityRequest.upsert({
    where:  { id: IDS.availReq },
    create: { id: IDS.availReq, organizationId: IDS.org, weekStart: w_next, deadline: availDeadline, status: "OPEN" },
    update: { weekStart: w_next, deadline: availDeadline, status: "OPEN" },
  })

  type DayPlan = { offset: number; isAvailable: boolean; preferredStart?: string; preferredEnd?: string }

  const SUBMISSIONS: Array<{ subId: string; employeeId: string; days: DayPlan[] }> = [
    {
      subId:      IDS.subSarah,
      employeeId: IDS.empSarah,
      days: [
        { offset: 0, isAvailable: true,  preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 1, isAvailable: true,  preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 2, isAvailable: false },
        { offset: 3, isAvailable: true,  preferredStart: "11:00", preferredEnd: "19:00" },
        { offset: 4, isAvailable: true,  preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 5, isAvailable: true,  preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 6, isAvailable: false },
      ],
    },
    {
      subId:      IDS.subJames,
      employeeId: IDS.empJames,
      days: [
        { offset: 0, isAvailable: true,  preferredStart: "11:00", preferredEnd: "19:00" },
        { offset: 1, isAvailable: false },
        { offset: 2, isAvailable: true,  preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 3, isAvailable: true,  preferredStart: "11:00", preferredEnd: "19:00" },
        { offset: 4, isAvailable: true,  preferredStart: "15:00", preferredEnd: "22:00" },
        { offset: 5, isAvailable: false },
        { offset: 6, isAvailable: false },
      ],
    },
    {
      subId:      IDS.subMia,
      employeeId: IDS.empMia,
      days: [
        { offset: 0, isAvailable: true,  preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 1, isAvailable: true,  preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 2, isAvailable: true,  preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 3, isAvailable: false },
        { offset: 4, isAvailable: true,  preferredStart: "11:00", preferredEnd: "19:00" },
        { offset: 5, isAvailable: true,  preferredStart: "11:00", preferredEnd: "19:00" },
        { offset: 6, isAvailable: false },
      ],
    },
    {
      subId:      IDS.subLena,
      employeeId: IDS.empLena,
      days: [
        { offset: 0, isAvailable: true,  preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 1, isAvailable: true,  preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 2, isAvailable: true,  preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 3, isAvailable: true,  preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 4, isAvailable: true,  preferredStart: "07:00", preferredEnd: "15:00" },
        { offset: 5, isAvailable: false },
        { offset: 6, isAvailable: false },
      ],
    },
  ]

  for (const sub of SUBMISSIONS) {
    await db.availabilitySubmission.upsert({
      where:  { requestId_employeeId: { requestId: IDS.availReq, employeeId: sub.employeeId } },
      create: { id: sub.subId, requestId: IDS.availReq, employeeId: sub.employeeId, organizationId: IDS.org },
      update: {},
    })

    // AvailabilityDay has no stable unique key → delete and recreate each run
    await db.availabilityDay.deleteMany({ where: { submissionId: sub.subId } })
    await db.availabilityDay.createMany({
      data: sub.days.map((d) => ({
        submissionId:   sub.subId,
        date:           weekDay(w_next, d.offset),
        isAvailable:    d.isAvailable,
        preferredStart: d.isAvailable ? (d.preferredStart ?? null) : null,
        preferredEnd:   d.isAvailable ? (d.preferredEnd   ?? null) : null,
      })),
    })
  }

  // ── 9. Time-off requests ──────────────────────────────────────────────────
  console.log("9/10 Seeding time-off requests…")

  const timeOffRequests = [
    // Lena: 2 weeks ago, Mon–Tue — APPROVED (holiday)
    {
      id: TOR.lenaApproved,
      employeeId: IDS.empLena,
      startDate: addDays(w2, 0),
      endDate:   addDays(w2, 1),
      reason:    "Annual leave",
      status:    "APPROVED" as const,
      reviewNote: null,
    },
    // Tom: last week Friday — DENIED (too short notice)
    {
      id: TOR.tomDenied,
      employeeId: IDS.empTom,
      startDate: addDays(w1, 4),
      endDate:   addDays(w1, 4),
      reason:    "Personal errand",
      status:    "DENIED" as const,
      reviewNote: "Too short notice — please request at least 1 week ahead.",
    },
    // James: next week Wed–Fri — PENDING
    {
      id: TOR.jamesPending,
      employeeId: IDS.empJames,
      startDate: addDays(w_p1, 2),
      endDate:   addDays(w_p1, 4),
      reason:    "Family trip",
      status:    "PENDING" as const,
      reviewNote: null,
    },
    // Nadia: two weeks from now Mon–Tue — PENDING
    {
      id: TOR.nadiaPending,
      employeeId: IDS.empNadia,
      startDate: addDays(w_p2, 0),
      endDate:   addDays(w_p2, 1),
      reason:    "Medical appointments",
      status:    "PENDING" as const,
      reviewNote: null,
    },
  ]

  for (const r of timeOffRequests) {
    await db.timeOffRequest.upsert({
      where: { id: r.id },
      create: {
        id:             r.id,
        organizationId: IDS.org,
        employeeId:     r.employeeId,
        startDate:      r.startDate,
        endDate:        r.endDate,
        reason:         r.reason,
        status:         r.status,
        reviewNote:     r.reviewNote,
      },
      update: {
        startDate:  r.startDate,
        endDate:    r.endDate,
        status:     r.status,
        reviewNote: r.reviewNote,
      },
    })
    console.log(`     → ${r.id} (${r.status})`)
  }

  // ── 10. Link SUPERADMIN_EMAIL to the seeded org ──────────────────────────
  console.log("10/10 Linking admin account…")

  const adminEmail = process.env.SUPERADMIN_EMAIL
  if (adminEmail) {
    console.log(`     → ${adminEmail}`)
    const adminUser = await db.user.upsert({
      where:  { email: adminEmail },
      create: { email: adminEmail, role: "ADMIN" },
      update: { role: "ADMIN" },
    })
    await db.membership.upsert({
      where:  { userId_organizationId: { userId: adminUser.id, organizationId: IDS.org } },
      create: { userId: adminUser.id, organizationId: IDS.org, role: "MANAGER" },
      update: { role: "MANAGER" },
    })
    // Link the admin's User record to their Employee record so My Shifts works
    await db.employee.updateMany({
      where: { organizationId: IDS.org, email: adminEmail },
      data:  { userId: adminUser.id },
    })
  } else {
    console.log("     → SUPERADMIN_EMAIL not set; skipping admin link")
  }

  console.log("\nSeed complete ✓")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
