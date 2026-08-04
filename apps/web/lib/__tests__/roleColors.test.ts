/**
 * A shift is coloured by ITS role, not the employee's.
 *
 * Colouring by `employee.jobRole` was a silent bug: a chef covering the bar got
 * a kitchen-coloured bar, so the grid read as "kitchen is staffed" for a night
 * nobody was in the kitchen. Nothing catches that — it type-checks, it renders,
 * and it is only wrong to someone reading the schedule. Hence a test.
 */

import { describe, it, expect } from "vitest"
import { shiftColorToken } from "@/lib/roleColors"

const ROLES = [
  { name: "Kitchen", color: "orange" },
  { name: "Front of house", color: "blue" },
  { name: "Bar", color: "purple" },
]

describe("shiftColorToken", () => {
  it("uses the shift's role when it differs from the employee's", () => {
    // A chef picking up a bar shift.
    expect(shiftColorToken({ jobRole: "Bar" }, "Kitchen", ROLES)).toBe("purple")
  })

  it("uses the employee's role when the shift has none (legacy rows)", () => {
    expect(shiftColorToken({ jobRole: null }, "Kitchen", ROLES)).toBe("orange")
    expect(shiftColorToken({ jobRole: "" }, "Front of house", ROLES)).toBe("blue")
  })

  it("paints sick days as sick regardless of either role", () => {
    expect(shiftColorToken({ jobRole: "Bar", colorTag: "sick" }, "Kitchen", ROLES)).toBe("sick")
  })

  it("falls back to gray for a role that no longer exists", () => {
    // Roles can be renamed or deleted after shifts were written against them.
    expect(shiftColorToken({ jobRole: "Sommelier" }, "Kitchen", ROLES)).toBe("gray")
  })

  it("agrees with itself for the ordinary case", () => {
    expect(shiftColorToken({ jobRole: "Kitchen" }, "Kitchen", ROLES)).toBe("orange")
  })
})
