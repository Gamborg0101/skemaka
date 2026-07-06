/**
 * Static fixture for the public "try the demo restaurant" mode.
 *
 * This data is READ-ONLY and lives entirely in code — the /demo route renders it
 * directly and never touches the database, NextAuth, Stripe, or any org. There is
 * therefore no way for the demo to pollute real customer data: it has no write
 * path at all. The same fixture is the source for the marketing screenshots
 * (see screenshots strategy), so the demo and the landing page never disagree.
 *
 * "The Copper Pan" is a 6-person neighbourhood bistro: closed Monday, dinner
 * service Tue–Sun. The week intentionally contains two conflicts so visitors see
 * Skemaka catch problems before publishing.
 */

export type DemoRole = "Kitchen" | "Front of house" | "Bar"

export interface DemoStaff {
  id: string
  name: string
  title: string // shown under the name, e.g. "Head chef"
  role: DemoRole
  hourlyWage: number // in DEMO_RESTAURANT.currency
  contractedHours: number
}

export interface DemoShift {
  staffId: string
  day: number // 0 = Mon … 6 = Sun
  start: string // "HH:MM"
  end: string // "HH:MM"
  breakMinutes: number
}

export interface DemoFlag {
  staffId: string
  day: number
  /** Plain-language reason this assignment is a problem. */
  note: string
}

export const DEMO_RESTAURANT = {
  name: "The Copper Pan",
  tagline: "Neighbourhood bistro · 6 staff · dinner service",
  currency: "€",
  weekLabel: "Mon 8 – Sun 14 June",
} as const

export const DEMO_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

export const ROLE_STYLES: Record<DemoRole, { chip: string; dot: string }> = {
  Kitchen: { chip: "bg-amber-100 text-amber-900 border-amber-200", dot: "bg-amber-400" },
  "Front of house": { chip: "bg-blue-100 text-blue-900 border-blue-200", dot: "bg-blue-400" },
  Bar: { chip: "bg-purple-100 text-purple-900 border-purple-200", dot: "bg-purple-400" },
}

export const DEMO_STAFF: DemoStaff[] = [
  { id: "marco", name: "Marco Rossi", title: "Head chef", role: "Kitchen", hourlyWage: 18.5, contractedHours: 40 },
  { id: "aoife", name: "Aoife Byrne", title: "Sous chef", role: "Kitchen", hourlyWage: 15.0, contractedHours: 38 },
  { id: "sam", name: "Sam Okoro", title: "Kitchen porter", role: "Kitchen", hourlyWage: 11.5, contractedHours: 16 },
  { id: "lena", name: "Lena Vogt", title: "Waiter", role: "Front of house", hourlyWage: 12.5, contractedHours: 25 },
  { id: "tom", name: "Tom Walsh", title: "Waiter", role: "Front of house", hourlyWage: 12.0, contractedHours: 20 },
  { id: "priya", name: "Priya Shah", title: "Bartender", role: "Bar", hourlyWage: 13.5, contractedHours: 30 },
]

// Mon (0) is closed. Dinner service Tue–Sun; weekends start earlier.
export const DEMO_SHIFTS: DemoShift[] = [
  // Marco — head chef, in for every service
  { staffId: "marco", day: 1, start: "15:00", end: "23:00", breakMinutes: 30 },
  { staffId: "marco", day: 2, start: "15:00", end: "23:00", breakMinutes: 30 },
  { staffId: "marco", day: 3, start: "15:00", end: "23:00", breakMinutes: 30 },
  { staffId: "marco", day: 4, start: "14:00", end: "23:30", breakMinutes: 30 },
  { staffId: "marco", day: 5, start: "12:00", end: "23:30", breakMinutes: 45 },
  // Aoife — sous, covers the days Marco needs support / his day off
  { staffId: "aoife", day: 1, start: "15:00", end: "23:00", breakMinutes: 30 },
  { staffId: "aoife", day: 4, start: "15:00", end: "23:30", breakMinutes: 30 },
  { staffId: "aoife", day: 5, start: "12:00", end: "23:30", breakMinutes: 45 },
  { staffId: "aoife", day: 6, start: "12:00", end: "22:00", breakMinutes: 45 },
  // Sam — KP, busiest nights only
  { staffId: "sam", day: 4, start: "17:00", end: "23:30", breakMinutes: 30 },
  { staffId: "sam", day: 5, start: "17:00", end: "23:30", breakMinutes: 30 },
  // Lena — FOH
  { staffId: "lena", day: 2, start: "16:00", end: "23:00", breakMinutes: 30 },
  { staffId: "lena", day: 3, start: "16:00", end: "23:00", breakMinutes: 30 },
  { staffId: "lena", day: 5, start: "16:00", end: "23:30", breakMinutes: 30 },
  { staffId: "lena", day: 6, start: "12:00", end: "20:00", breakMinutes: 30 }, // ⚠ conflict: Lena marked Sat unavailable
  // Tom — FOH
  { staffId: "tom", day: 3, start: "17:00", end: "23:00", breakMinutes: 30 },
  { staffId: "tom", day: 4, start: "17:00", end: "23:30", breakMinutes: 30 }, // ⚠ conflict: Tom is on approved time-off Fri
  // Priya — bar
  { staffId: "priya", day: 2, start: "16:00", end: "23:30", breakMinutes: 30 },
  { staffId: "priya", day: 4, start: "16:00", end: "00:00", breakMinutes: 30 },
  { staffId: "priya", day: 5, start: "16:00", end: "00:00", breakMinutes: 30 },
  { staffId: "priya", day: 6, start: "14:00", end: "23:00", breakMinutes: 45 },
]

/** Approved time-off — shown greyed on the grid. */
export const DEMO_TIME_OFF: { staffId: string; day: number; reason: string }[] = [
  { staffId: "tom", day: 4, reason: "Annual leave" },
]

/**
 * Conflicts Skemaka flags before publish. These are derived from the data above
 * but listed explicitly so the demo can highlight them without re-deriving.
 */
export const DEMO_FLAGS: DemoFlag[] = [
  { staffId: "tom", day: 4, note: "Tom is on approved leave on Friday — but he's on the schedule." },
  { staffId: "lena", day: 6, note: "Lena marked Saturday as unavailable — but she's on the schedule." },
]

// ── Derived helpers (pure) ──────────────────────────────────────────────────────

/** Net paid hours for a shift, accounting for the unpaid break and midnight wrap. */
export function shiftHours(s: Pick<DemoShift, "start" | "end" | "breakMinutes">): number {
  const [sh, sm] = s.start.split(":").map(Number)
  const [eh, em] = s.end.split(":").map(Number)
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60 // crosses midnight (e.g. 16:00 → 00:00)
  return Math.max(0, (mins - s.breakMinutes) / 60)
}

export interface DemoWeekSummary {
  totalHours: number
  totalCost: number
  avgRate: number
}

export function demoWeekSummary(): DemoWeekSummary {
  const wageById = new Map(DEMO_STAFF.map((s) => [s.id, s.hourlyWage]))
  let totalHours = 0
  let totalCost = 0
  for (const shift of DEMO_SHIFTS) {
    const hours = shiftHours(shift)
    totalHours += hours
    totalCost += hours * (wageById.get(shift.staffId) ?? 0)
  }
  return {
    totalHours: Math.round(totalHours * 10) / 10,
    totalCost: Math.round(totalCost),
    avgRate: totalHours > 0 ? Math.round((totalCost / totalHours) * 100) / 100 : 0,
  }
}

export function hoursForStaff(staffId: string): number {
  return Math.round(
    DEMO_SHIFTS.filter((s) => s.staffId === staffId).reduce((sum, s) => sum + shiftHours(s), 0) * 10,
  ) / 10
}
