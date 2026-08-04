/**
 * The demo sandbox must be coherent on every day a visitor can arrive.
 *
 * The bug that motivated this file only reproduced when "today" happened to be
 * a Monday — the demo restaurant was closed Mondays, the schedule opens on the
 * real calendar date, and the closed-day view drops every employee row while
 * the roster strip above it still lists all nine people. It shipped for weeks
 * because nothing tested a Monday.
 *
 * So the matrix walks all seven weekdays, both locales, and the dates that
 * historically break date arithmetic.
 */

import { describe, expect, it } from "vitest"
import { buildDemoPlan, type DemoLocale } from "@/lib/demo/demoPlan"
import { checkDemoPlan } from "@/lib/demo/demoInvariants"

const LOCALES: DemoLocale[] = ["en", "da"]

const ARRIVALS = [
  "2026-08-03", // Mon — the arrival date that produced the original bug report
  "2026-08-04", // Tue
  "2026-08-05", // Wed
  "2026-08-06", // Thu
  "2026-08-07", // Fri
  "2026-08-08", // Sat
  "2026-08-09", // Sun
  "2026-12-28", // ISO week 53
  "2026-12-31", // year boundary
  "2027-01-01", // year boundary, other side
  "2026-10-25", // EU DST ends
  "2027-03-28", // EU DST starts
  "2028-02-29", // leap day
  "2026-08-31", // month boundary
]

/** Stable ids so plans are diffable and the determinism check is meaningful. */
function seqId() {
  let n = 0
  return () => `id_${String(++n).padStart(4, "0")}`
}

const planFor = (locale: DemoLocale, iso: string) =>
  buildDemoPlan({ locale, now: new Date(`${iso}T09:15:00`), newId: seqId() })

const format = (violations: ReturnType<typeof checkDemoPlan>) =>
  violations.map((x) => `[${x.id}] ${x.message}`)

describe.each(LOCALES)("demo plan integrity — %s", (locale) => {
  it.each(ARRIVALS)("has no invariant errors for a visitor arriving on %s", (iso) => {
    const violations = checkDemoPlan(planFor(locale, iso)).filter((x) => x.severity === "error")
    // Assert on the messages, not a count — a failure names the broken invariant.
    expect(format(violations)).toEqual([])
  })

  it.each(ARRIVALS)("has no warnings either for %s", (iso) => {
    const violations = checkDemoPlan(planFor(locale, iso)).filter((x) => x.severity === "warn")
    expect(format(violations)).toEqual([])
  })

  it("is deterministic for a fixed arrival", () => {
    const now = new Date("2026-08-03T09:15:00")
    expect(buildDemoPlan({ locale, now, newId: seqId() })).toEqual(
      buildDemoPlan({ locale, now, newId: seqId() }),
    )
  })
})

describe("regressions this suite exists to prevent", () => {
  it("a Monday arrival lands on an open day that has shifts", () => {
    const plan = planFor("en", "2026-08-03")
    expect(plan.org.settings.hours[0].isOpen).toBe(true)
    const monday = plan.landing.weekStart
    expect(plan.shifts.filter((s) => s.date === monday && !s.cancelledAt).length).toBeGreaterThanOrEqual(4)
  })

  it("opens the venue every day of the week", () => {
    const plan = planFor("en", "2026-08-03")
    expect(plan.org.settings.hours.filter((h) => h.isOpen)).toHaveLength(7)
  })

  it("gives every employee a shift in the landing week — no blank rows", () => {
    const plan = planFor("en", "2026-08-03")
    const week0 = new Set(plan.schedules.filter((s) => s.weekIdx === 0).map((s) => s.id))
    const staffed = new Set(
      plan.shifts.filter((s) => week0.has(s.scheduleId) && !s.cancelledAt).map((s) => s.employeeId),
    )
    expect(plan.employees.filter((e) => !staffed.has(e.id)).map((e) => e.name)).toEqual([])
  })

  it("rotates the roster — consecutive weeks are not identical", () => {
    const plan = planFor("en", "2026-08-03")
    const crew = (weekIdx: number) => {
      const id = plan.schedules.find((s) => s.weekIdx === weekIdx)!.id
      return plan.shifts
        .filter((s) => s.scheduleId === id)
        .map((s) => `${s.date}__${s.employeeId}`)
        .sort()
        .join("|")
    }
    expect(crew(0)).not.toEqual(crew(1))
  })

  it("never lets the accepted shift-offer candidate be someone already working that slot", () => {
    const plan = planFor("en", "2026-08-03")
    const accepted = plan.shiftOffer.recipients.filter((r) => r.response === "ACCEPTED")
    expect(accepted.length).toBeGreaterThan(0)
    for (const r of accepted) {
      const sameDay = plan.shifts.filter(
        (s) => s.employeeId === r.employeeId && s.date === plan.shiftOffer.date && !s.cancelledAt,
      )
      expect(sameDay).toEqual([])
    }
  })

  it("never rosters someone during their own approved leave", () => {
    const plan = planFor("en", "2026-08-03")
    for (const off of plan.timeOff.filter((t) => t.status === "APPROVED")) {
      const clashes = plan.shifts.filter(
        (s) =>
          s.employeeId === off.employeeId &&
          !s.cancelledAt &&
          s.colorTag !== "sick" &&
          s.date >= off.startDate &&
          s.date <= off.endDate,
      )
      expect(clashes).toEqual([])
    }
  })
})

// ── Mutation tests ────────────────────────────────────────────────────────────
// Without these, checkDemoPlan could silently degrade to `return []` and every
// test above would still pass.
describe("checkDemoPlan catches what it claims to", () => {
  const base = () => planFor("en", "2026-08-05")
  const ids = (plan: ReturnType<typeof base>) => checkDemoPlan(plan).map((x) => x.id)

  it("DEMO-001 — dangling employee reference", () => {
    const plan = base()
    plan.shifts[0].employeeId = "ghost"
    expect(ids(plan)).toContain("DEMO-001")
  })

  it("DEMO-003 — a shift job role with no JobRole record", () => {
    const plan = base()
    plan.shifts.find((s) => s.colorTag !== "sick")!.jobRole = "Sommelier"
    expect(ids(plan)).toContain("DEMO-003")
  })

  it("DEMO-010 — the same person twice on one date", () => {
    const plan = base()
    const s = plan.shifts.find((x) => !x.cancelledAt && x.colorTag !== "sick")!
    plan.shifts.push({ ...s, id: "dupe" })
    expect(ids(plan)).toContain("DEMO-010")
  })

  it("DEMO-011 — approved leave over a rostered shift", () => {
    const plan = base()
    const s = plan.shifts.find((x) => !x.cancelledAt && x.colorTag !== "sick")!
    plan.timeOff.push({
      employeeId: s.employeeId,
      startDate: s.date,
      endDate: s.date,
      reason: "Holiday",
      status: "APPROVED",
    })
    expect(ids(plan)).toContain("DEMO-011")
  })

  it("DEMO-013 — an accepted offer that overlaps an existing shift", () => {
    const plan = base()
    const s = plan.shifts.find(
      (x) => !x.cancelledAt && x.colorTag !== "sick" && x.jobRole === "Front of house",
    )!
    plan.shiftOffer.date = s.date
    plan.shiftOffer.startTime = s.startTime
    plan.shiftOffer.endTime = s.endTime
    plan.shiftOffer.recipients = [{ employeeId: s.employeeId, response: "ACCEPTED" }]
    expect(ids(plan)).toContain("DEMO-013")
  })

  it("DEMO-020/022/030 — closing a day the visitor can land on", () => {
    const plan = base()
    plan.org.settings.hours[0].isOpen = false
    expect(ids(plan)).toEqual(expect.arrayContaining(["DEMO-020", "DEMO-022", "DEMO-030"]))
  })

  it("DEMO-032 — an employee with no shifts in the landing week", () => {
    const plan = base()
    const victim = plan.employees[3].id
    const week0 = new Set(plan.schedules.filter((s) => s.weekIdx === 0).map((s) => s.id))
    plan.shifts = plan.shifts.filter((s) => !(week0.has(s.scheduleId) && s.employeeId === victim))
    expect(ids(plan)).toContain("DEMO-032")
  })

  it("DEMO-041 — no clocked history", () => {
    const plan = base()
    plan.timeEntries = []
    expect(ids(plan)).toContain("DEMO-041")
  })

  it("DEMO-050 — a real email address escaping into the sandbox", () => {
    const plan = base()
    plan.employees[0].email = "someone@gmail.com"
    expect(ids(plan)).toContain("DEMO-050")
  })
})
