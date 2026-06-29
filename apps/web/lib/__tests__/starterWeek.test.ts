/**
 * Unit tests for the pure starter-week generator. The DB-touching service
 * (generateStarterWeek) is a thin wrapper around this; the shift-shape logic is
 * fully covered here without a database.
 */
import { describe, it, expect } from "vitest"
import { buildStarterShifts, STARTER_DEFAULTS } from "@/lib/services/scheduleService"

const WEEK_START = "2026-06-08" // a Monday

const employees = [
  { id: "e1", jobRole: "Barista" },
  { id: "e2", jobRole: "Kitchen" },
]

describe("buildStarterShifts", () => {
  it("creates one shift per employee per weekday (Mon–Fri)", () => {
    const shifts = buildStarterShifts(employees, WEEK_START)
    expect(shifts).toHaveLength(employees.length * STARTER_DEFAULTS.weekdayCount)
    expect(shifts.filter((s) => s.employeeId === "e1")).toHaveLength(5)
  })

  it("uses the default times, break, and the employee's own job role", () => {
    const [first] = buildStarterShifts(employees, WEEK_START)
    expect(first).toMatchObject({
      employeeId: "e1",
      date: "2026-06-08",
      startTime: STARTER_DEFAULTS.startTime,
      endTime: STARTER_DEFAULTS.endTime,
      breakMinutes: STARTER_DEFAULTS.breakMinutes,
      jobRole: "Barista",
    })
  })

  it("spreads dates Mon→Fri without crossing into the weekend", () => {
    const dates = buildStarterShifts([employees[0]], WEEK_START).map((s) => s.date)
    expect(dates).toEqual([
      "2026-06-08", "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12",
    ])
  })

  it("returns nothing when there are no employees", () => {
    expect(buildStarterShifts([], WEEK_START)).toEqual([])
  })
})
