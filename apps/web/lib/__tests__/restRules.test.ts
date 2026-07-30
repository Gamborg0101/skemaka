import { describe, it, expect } from "vitest"
import {
  restHoursBetween,
  grossDayHours,
  findRuleWarnings,
  MIN_REST_HOURS,
} from "@/lib/restRules"
import type { Shift } from "@/types"

function shift(overrides: Partial<Shift> & Pick<Shift, "employeeId" | "date" | "startTime" | "endTime">): Shift {
  return {
    id: Math.random().toString(36).slice(2),
    scheduleId: "sched_1",
    organizationId: "org_1",
    breakMinutes: 30,
    jobRole: "Kitchen",
    notes: null,
    colorTag: "orange",
    cancelledAt: null,
    publishedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("restHoursBetween", () => {
  it("computes rest across consecutive days", () => {
    expect(restHoursBetween(
      { date: "2026-07-13", startTime: "15:00", endTime: "23:00" },
      { date: "2026-07-14", startTime: "10:00", endTime: "18:00" },
    )).toBe(11)
  })

  it("treats an end at 00:00 (or before start) as crossing midnight", () => {
    // 16:00–00:00 ends at midnight; next day 08:00 → 8h rest.
    expect(restHoursBetween(
      { date: "2026-07-13", startTime: "16:00", endTime: "00:00" },
      { date: "2026-07-14", startTime: "08:00", endTime: "16:00" },
    )).toBe(8)
  })
})

describe("grossDayHours", () => {
  it("measures the day incl. breaks and midnight wrap", () => {
    expect(grossDayHours({ startTime: "14:00", endTime: "22:00" })).toBe(8)
    expect(grossDayHours({ startTime: "12:00", endTime: "00:00" })).toBe(12)
    expect(grossDayHours({ startTime: "10:00", endTime: "00:30" })).toBe(14.5)
  })
})

describe("findRuleWarnings", () => {
  it("flags under-11h rest on the later shift", () => {
    const warnings = findRuleWarnings([
      shift({ employeeId: "emp_1", date: "2026-07-13", startTime: "15:00", endTime: "23:00" }),
      shift({ employeeId: "emp_1", date: "2026-07-14", startTime: "08:00", endTime: "16:00" }),
    ])
    expect(warnings.get("emp_1__2026-07-14")).toEqual({ type: "rest", hours: 9 })
    expect(warnings.has("emp_1__2026-07-13")).toBe(false)
  })

  it(`does not flag exactly ${MIN_REST_HOURS}h of rest`, () => {
    const warnings = findRuleWarnings([
      shift({ employeeId: "emp_1", date: "2026-07-13", startTime: "15:00", endTime: "23:00" }),
      shift({ employeeId: "emp_1", date: "2026-07-14", startTime: "10:00", endTime: "18:00" }),
    ])
    expect(warnings.size).toBe(0)
  })

  it("ignores gaps with a free day in between", () => {
    const warnings = findRuleWarnings([
      shift({ employeeId: "emp_1", date: "2026-07-13", startTime: "15:00", endTime: "23:00" }),
      shift({ employeeId: "emp_1", date: "2026-07-15", startTime: "08:00", endTime: "16:00" }),
    ])
    expect(warnings.size).toBe(0)
  })

  it("flags a 13h+ working day", () => {
    const warnings = findRuleWarnings([
      shift({ employeeId: "emp_1", date: "2026-07-13", startTime: "09:00", endTime: "22:30" }),
    ])
    expect(warnings.get("emp_1__2026-07-13")).toEqual({ type: "longDay", hours: 13.5 })
  })

  it("prefers the rest warning when both would hit the same date", () => {
    const warnings = findRuleWarnings([
      shift({ employeeId: "emp_1", date: "2026-07-13", startTime: "12:00", endTime: "23:30" }),
      shift({ employeeId: "emp_1", date: "2026-07-14", startTime: "06:00", endTime: "19:30" }), // 13.5h day AND 6.5h rest
    ])
    expect(warnings.get("emp_1__2026-07-14")).toEqual({ type: "rest", hours: 6.5 })
  })

  it("keeps employees separate and skips sick/cancelled shifts", () => {
    const warnings = findRuleWarnings([
      shift({ employeeId: "emp_1", date: "2026-07-13", startTime: "15:00", endTime: "23:00" }),
      shift({ employeeId: "emp_2", date: "2026-07-14", startTime: "08:00", endTime: "16:00" }),
      shift({ employeeId: "emp_3", date: "2026-07-13", startTime: "15:00", endTime: "23:00", cancelledAt: "2026-07-12T00:00:00.000Z" }),
      shift({ employeeId: "emp_3", date: "2026-07-14", startTime: "08:00", endTime: "16:00" }),
      shift({ employeeId: "emp_4", date: "2026-07-13", startTime: "00:00", endTime: "00:00", colorTag: "sick", jobRole: "Sick Day" }),
      shift({ employeeId: "emp_4", date: "2026-07-14", startTime: "08:00", endTime: "16:00" }),
    ])
    expect(warnings.size).toBe(0)
  })
})
