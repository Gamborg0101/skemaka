/**
 * Proves a demo plan coherent before it becomes a sandbox.
 *
 * The demo is the first interaction a prospective customer has with the
 * product, and it is regenerated per visitor relative to "now" — so its
 * curation cannot be verified by a human eyeballing it once. It has to be
 * enforced by code, on every possible arrival date.
 *
 * Returns EVERY violation rather than throwing on the first, so one failing CI
 * run tells the whole story. `error` blocks the sandbox from being written at
 * all; `warn` is logged and tolerated (a half-translated string should never
 * take down the public demo entry point — an empty landing screen should).
 *
 * Every id below is regression-tested in lib/__tests__/demoIntegrity.test.ts.
 * If you relax an invariant, delete its test and say why in the commit.
 */

import { addDays, calcHours } from "@/lib/dateUtils"
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo/constants"
import { findRuleWarnings } from "@/lib/restRules"
import type { Shift } from "@/types"
import { dayIndexOf, NEARBY_WEEKS, type DemoPlan, type PlannedShift } from "@/lib/demo/demoPlan"

export type Severity = "error" | "warn"
export interface DemoViolation {
  id: string
  severity: Severity
  message: string
}

const MIN_LANDING_DAY_SHIFTS = 4
const MIN_LANDING_DAY_ROLES = 2
const MIN_LANDING_WEEK_SHIFTS = 25
const MIN_LAST_WEEK_ENTRIES = 20
const MIN_CLOCKED_RATIO = 0.7

const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

const overlaps = (a: PlannedShift, b: PlannedShift) =>
  a.date === b.date && mins(a.startTime) < mins(b.endTime) && mins(b.startTime) < mins(a.endTime)

const isLive = (s: PlannedShift) => !s.cancelledAt && s.colorTag !== "sick"

export function checkDemoPlan(plan: DemoPlan): DemoViolation[] {
  const v: DemoViolation[] = []
  const err = (id: string, message: string) => v.push({ id, severity: "error", message })
  const warn = (id: string, message: string) => v.push({ id, severity: "warn", message })

  const empIds = new Set(plan.employees.map((e) => e.id))
  const empById = new Map(plan.employees.map((e) => [e.id, e]))
  const roleNames = new Set(plan.jobRoles.map((r) => r.name))
  const scheduleById = new Map(plan.schedules.map((s) => [s.id, s]))
  const shiftById = new Map(plan.shifts.map((s) => [s.id, s]))
  const live = plan.shifts.filter(isLive)
  const nameOf = (id: string) => empById.get(id)?.name ?? id

  const shiftsByWeek = new Map<number, PlannedShift[]>()
  for (const s of plan.shifts) {
    const w = scheduleById.get(s.scheduleId)?.weekIdx
    if (w === undefined) continue
    const list = shiftsByWeek.get(w) ?? []
    list.push(s)
    shiftsByWeek.set(w, list)
  }

  // ── Referential integrity ───────────────────────────────────────────────────
  for (const s of plan.shifts) {
    if (!empIds.has(s.employeeId)) err("DEMO-001", `shift ${s.id} → unknown employee ${s.employeeId}`)
    const sched = scheduleById.get(s.scheduleId)
    if (!sched) {
      err("DEMO-002", `shift ${s.id} → unknown schedule ${s.scheduleId}`)
      continue
    }
    const weekEnd = addDays(sched.weekStart, 6)
    if (s.date < sched.weekStart || s.date > weekEnd) {
      err("DEMO-002", `shift ${s.id} on ${s.date} falls outside its week ${sched.weekStart}…${weekEnd}`)
    }
    // Sick days carry a localized pseudo-role and are exempt by design.
    if (s.colorTag !== "sick" && !roleNames.has(s.jobRole)) {
      err("DEMO-003", `shift ${s.id} has jobRole "${s.jobRole}" with no matching JobRole record`)
    }
    if ((s.publishedAt !== null) !== (sched.publishedAt !== null)) {
      err("DEMO-016", `shift ${s.id} publish state disagrees with its schedule (week ${sched.weekIdx})`)
    }
  }

  for (const e of plan.employees) {
    if (!roleNames.has(e.jobRole)) err("DEMO-004", `employee ${e.name} → unknown jobRole "${e.jobRole}"`)
  }
  for (const t of plan.shiftTemplates) {
    if (!roleNames.has(t.jobRole)) err("DEMO-004", `template "${t.name}" → unknown jobRole "${t.jobRole}"`)
  }

  for (const te of plan.timeEntries) {
    const shift = shiftById.get(te.shiftId)
    if (!shift) {
      err("DEMO-005", `time entry → unknown shift ${te.shiftId}`)
      continue
    }
    if (shift.cancelledAt) err("DEMO-005", `time entry on ${shift.date} belongs to a cancelled shift`)
    if (te.clockIn >= te.clockOut) err("DEMO-005", `time entry on shift ${te.shiftId} clocks out before it clocks in`)
    if (te.clockOut >= plan.now) err("DEMO-005", `time entry on shift ${te.shiftId} clocks out in the future`)
  }

  for (const sub of plan.availability.submissions) {
    if (!empIds.has(sub.employeeId)) err("DEMO-006", `availability submission → unknown employee ${sub.employeeId}`)
  }
  for (const t of plan.timeOff) {
    if (!empIds.has(t.employeeId)) err("DEMO-006", `time-off request → unknown employee ${t.employeeId}`)
  }
  if (!empIds.has(plan.coverRequest.requesterEmployeeId)) {
    err("DEMO-006", "cover request → unknown requester")
  }
  if (!shiftById.has(plan.coverRequest.shiftId)) err("DEMO-006", "cover request → unknown shift")
  if (!roleNames.has(plan.shiftOffer.jobRole)) {
    err("DEMO-006", `shift offer jobRole "${plan.shiftOffer.jobRole}" has no matching JobRole record`)
  }
  for (const r of plan.shiftOffer.recipients) {
    if (!empIds.has(r.employeeId)) err("DEMO-006", `shift offer recipient → unknown employee ${r.employeeId}`)
  }

  const weekIdxs = plan.schedules.map((s) => s.weekIdx).sort((a, b) => a - b)
  if (new Set(weekIdxs).size !== weekIdxs.length) err("DEMO-007", "duplicate schedule for a week index")
  for (let i = 1; i < weekIdxs.length; i++) {
    if (weekIdxs[i] !== weekIdxs[i - 1] + 1) err("DEMO-007", `gap in seeded weeks near ${weekIdxs[i - 1]}`)
  }
  if (plan.employees.length > plan.org.seats) {
    warn("DEMO-008", `${plan.employees.length} employees exceeds ${plan.org.seats} seats`)
  }

  // ── Self-consistency ────────────────────────────────────────────────────────
  const byEmpDate = new Map<string, PlannedShift[]>()
  for (const s of live) {
    const key = `${s.employeeId}__${s.date}`
    const list = byEmpDate.get(key) ?? []
    list.push(s)
    byEmpDate.set(key, list)
  }
  for (const [, list] of byEmpDate) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (overlaps(list[i], list[j])) {
          err("DEMO-010", `${nameOf(list[i].employeeId)} is double-booked on ${list[i].date}`)
        }
      }
    }
  }
  // A sick day must not sit on top of a real shift either.
  for (const sick of plan.shifts.filter((s) => s.colorTag === "sick")) {
    if (live.some((s) => s.employeeId === sick.employeeId && s.date === sick.date)) {
      err("DEMO-010", `${nameOf(sick.employeeId)} has a sick day and a shift on ${sick.date}`)
    }
  }

  for (const off of plan.timeOff.filter((t) => t.status === "APPROVED")) {
    for (const s of live.filter((x) => x.employeeId === off.employeeId)) {
      if (s.date >= off.startDate && s.date <= off.endDate) {
        err(
          "DEMO-011",
          `${nameOf(off.employeeId)} is rostered ${s.date}, inside approved leave ${off.startDate}…${off.endDate}`,
        )
      }
    }
  }

  const unavailable = new Set(
    plan.availability.submissions.flatMap((sub) =>
      sub.days.filter((d) => !d.isAvailable).map((d) => `${sub.employeeId}__${d.date}`),
    ),
  )
  for (const s of live) {
    if (unavailable.has(`${s.employeeId}__${s.date}`)) {
      err("DEMO-012", `${nameOf(s.employeeId)} is rostered ${s.date} after declaring that day unavailable`)
    }
  }

  for (const r of plan.shiftOffer.recipients.filter((x) => x.response === "ACCEPTED")) {
    if (unavailable.has(`${r.employeeId}__${plan.shiftOffer.date}`)) {
      err("DEMO-013", `${nameOf(r.employeeId)} accepted an offer on ${plan.shiftOffer.date}, a day they marked unavailable`)
    }
    const clash = live.some(
      (s) =>
        s.employeeId === r.employeeId &&
        s.date === plan.shiftOffer.date &&
        mins(s.startTime) < mins(plan.shiftOffer.endTime) &&
        mins(plan.shiftOffer.startTime) < mins(s.endTime),
    )
    if (clash) {
      err("DEMO-013", `${nameOf(r.employeeId)} accepted an offer overlapping a shift they already have — Confirm would double-book`)
    }
  }

  const cover = shiftById.get(plan.coverRequest.shiftId)
  if (!cover || cover.cancelledAt || cover.colorTag === "sick" || !cover.publishedAt) {
    err("DEMO-014", "cover request does not point at a live, published shift")
  } else if (scheduleById.get(cover.scheduleId)?.weekIdx !== 0) {
    err("DEMO-014", "cover request is not in the landing week — the panel would look stale")
  }

  // Runs the REAL rule engine over the seed, so any future change to the
  // working-time rules automatically re-validates the demo.
  const nearbyShifts = [-1, 0, 1].flatMap((w) => shiftsByWeek.get(w) ?? [])
  const ruleWarnings = findRuleWarnings(nearbyShifts as unknown as Shift[])
  if (ruleWarnings.size > 0) {
    warn("DEMO-015", `demo trips ${ruleWarnings.size} of the product's own working-time warnings`)
  }

  // ── Opening hours ───────────────────────────────────────────────────────────
  plan.org.settings.hours.forEach((h, i) => {
    if (!h.isOpen) {
      err("DEMO-022", `weekday ${i} is closed — the UI opens on the real date, so a visitor can land on it`)
    }
  })
  for (const s of plan.shifts) {
    if (s.colorTag === "sick") continue
    const h = plan.org.settings.hours[dayIndexOf(s.date)]
    if (!h) continue
    if (!h.isOpen) {
      err("DEMO-020", `shift ${s.id} is on ${s.date}, a closed day`)
    } else if (mins(s.startTime) < mins(h.openTime) || mins(s.endTime) > mins(h.closeTime)) {
      err("DEMO-021", `shift ${s.id} (${s.startTime}–${s.endTime}) falls outside opening hours ${h.openTime}–${h.closeTime}`)
    }
  }

  // ── Nothing is empty, on any arrival date ───────────────────────────────────
  // The UI seeds its selected day from the real calendar date, so every weekday
  // of the landing week has to stand on its own as an opening screen.
  for (let d = 0; d < 7; d++) {
    const date = addDays(plan.landing.weekStart, d)
    const onDay = live.filter((s) => s.date === date)
    if (!plan.org.settings.hours[d]?.isOpen) {
      err("DEMO-030", `a visitor arriving on weekday ${d} lands on a closed day`)
    }
    if (onDay.length < MIN_LANDING_DAY_SHIFTS) {
      err("DEMO-030", `weekday ${d} (${date}) has only ${onDay.length} shifts — under ${MIN_LANDING_DAY_SHIFTS}`)
    }
    if (new Set(onDay.map((s) => s.jobRole)).size < MIN_LANDING_DAY_ROLES) {
      err("DEMO-030", `weekday ${d} (${date}) shows fewer than ${MIN_LANDING_DAY_ROLES} job roles`)
    }
  }

  const landingWeek = (shiftsByWeek.get(0) ?? []).filter(isLive)
  if (landingWeek.length < MIN_LANDING_WEEK_SHIFTS) {
    err("DEMO-031", `landing week has only ${landingWeek.length} shifts`)
  }
  if (landingWeek.some((s) => !s.publishedAt)) {
    err("DEMO-031", "landing week contains drafts — the header would show an amber draft badge, not Rolled out")
  }

  for (const w of NEARBY_WEEKS) {
    const wk = (shiftsByWeek.get(w) ?? []).filter(isLive)
    for (const e of plan.employees) {
      if (!wk.some((s) => s.employeeId === e.id)) {
        err("DEMO-032", `${e.name} has no shift in week ${w} — an all-blank row next to a staffed roster`)
      }
    }
  }

  for (const sched of plan.schedules) {
    const wk = (shiftsByWeek.get(sched.weekIdx) ?? []).filter(isLive)
    if (wk.length === 0) {
      err("DEMO-033", `week ${sched.weekIdx} is completely empty`)
      continue
    }
    for (const role of roleNames) {
      if (!wk.some((s) => s.jobRole === role)) {
        err("DEMO-034", `week ${sched.weekIdx} has no "${role}" shift — the role legend would be a lie`)
      }
    }
    for (let d = 0; d < 7; d++) {
      if (!plan.org.settings.hours[d]?.isOpen) continue
      if (!wk.some((s) => s.date === addDays(sched.weekStart, d))) {
        err("DEMO-033", `week ${sched.weekIdx}, open weekday ${d} has no shifts`)
      }
    }
  }

  const draftWeeks = plan.schedules.filter((s) => s.publishedAt === null)
  if (draftWeeks.length < 2) warn("DEMO-035", "fewer than 2 draft weeks — the Roll out flow has nothing to demo")

  // ── Money and timesheets ────────────────────────────────────────────────────
  const cost = landingWeek.reduce(
    (sum, s) => sum + calcHours(s.startTime, s.endTime, s.breakMinutes) * (empById.get(s.employeeId)?.hourlyWage ?? 0),
    0,
  )
  if (cost <= 0) err("DEMO-040", "landing-week labour cost is 0 — the Costs page opens empty")

  const lastWeek = (shiftsByWeek.get(-1) ?? []).filter(isLive)
  const lastWeekEntries = plan.timeEntries.filter((t) => lastWeek.some((s) => s.id === t.shiftId))
  if (lastWeekEntries.length < MIN_LAST_WEEK_ENTRIES) {
    err("DEMO-041", `last week has ${lastWeekEntries.length} time entries — timesheets look unused`)
  }
  if (lastWeek.length > 0 && lastWeekEntries.length / lastWeek.length < MIN_CLOCKED_RATIO) {
    err("DEMO-041", `only ${Math.round((lastWeekEntries.length / lastWeek.length) * 100)}% of last week's shifts were clocked`)
  }
  for (const e of plan.employees) {
    if (e.hourlyWage <= 0 || e.contractedHours <= 0) {
      err("DEMO-043", `${e.name} has a zero wage or contract`)
    }
    if (!plan.timeEntries.some((t) => t.employeeId === e.id)) {
      warn("DEMO-042", `${e.name} has no timesheet history`)
    }
  }

  // ── Safety and locale ───────────────────────────────────────────────────────
  const suffix = `@${DEMO_EMAIL_DOMAIN}`
  if (!plan.manager.email.endsWith(suffix)) err("DEMO-050", "manager email is not on the demo domain")
  for (const e of plan.employees) {
    if (!e.email.endsWith(suffix)) err("DEMO-050", `${e.name}'s email is not on the demo domain`)
  }

  const expectedCurrency = plan.locale === "da" ? "DKK" : "EUR"
  if (plan.org.currency !== expectedCurrency) {
    err("DEMO-051", `currency ${plan.org.currency} does not match locale ${plan.locale} (expected ${expectedCurrency})`)
  }
  const [lo, hi] = plan.locale === "da" ? [80, 200] : [9, 30]
  for (const e of plan.employees) {
    if (e.hourlyWage < lo || e.hourlyWage > hi) {
      err("DEMO-051", `${e.name}'s wage ${e.hourlyWage} is implausible for ${plan.org.currency}`)
    }
  }
  if (plan.locale === "da") {
    const english = /^(Kitchen early|Kitchen late|Dinner service|Evening bar|Flu|Holiday|Family visit|Sick Day)$/
    const strings = [
      plan.org.name,
      ...plan.shiftTemplates.map((t) => t.name),
      ...plan.timeOff.map((t) => t.reason),
      ...plan.shifts.map((s) => s.notes ?? ""),
      ...plan.shifts.filter((s) => s.colorTag === "sick").map((s) => s.jobRole),
    ]
    for (const s of strings) {
      if (english.test(s)) warn("DEMO-052", `untranslated string in the Danish sandbox: "${s}"`)
    }
  }

  return v
}

export class DemoIntegrityError extends Error {
  constructor(public readonly violations: DemoViolation[]) {
    super(
      `demo plan failed ${violations.length} invariant(s):\n` +
        violations.map((x) => `  [${x.id}] ${x.message}`).join("\n"),
    )
    this.name = "DemoIntegrityError"
  }
}
