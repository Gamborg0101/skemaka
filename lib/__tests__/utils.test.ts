import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  getMondayOfWeek,
  addDays,
  getISOWeek,
  getMondayOfISOWeek,
  calcHours,
} from "@/lib/dateUtils"

// ---------------------------------------------------------------------------
// Source: lib/orgSettings.ts  (reset before each test to avoid cross-test bleed)
// ---------------------------------------------------------------------------

interface DayHours {
  isOpen: boolean
  openTime: string
  closeTime: string
}

interface OrgSettings {
  hours: DayHours[]
}

let getOrgSettings: () => OrgSettings
let updateOrgSettings: (patch: Partial<OrgSettings>) => void

beforeEach(async () => {
  vi.resetModules()
  const mod = await import("@/lib/orgSettings")
  getOrgSettings = mod.getOrgSettings
  updateOrgSettings = mod.updateOrgSettings
})

// ===========================================================================
// Tests: getISOWeek
// ===========================================================================

describe("getISOWeek", () => {
  it("2026-01-01 is W1", () => {
    expect(getISOWeek("2026-01-01")).toBe(1)
  })
  it("2026-12-28 is W53", () => {
    expect(getISOWeek("2026-12-28")).toBe(53)
  })
  it("2015-12-31 is W53 (known edge case)", () => {
    expect(getISOWeek("2015-12-31")).toBe(53)
  })
  it("2016-01-01 is W53 (same week as 2015-12-31)", () => {
    expect(getISOWeek("2016-01-01")).toBe(53)
  })
  it("mid-year: 2026-06-15 is W25", () => {
    expect(getISOWeek("2026-06-15")).toBe(25)
  })
  it("week boundary: Monday 2026-03-30 is W14", () => {
    expect(getISOWeek("2026-03-30")).toBe(14)
  })
  it("week boundary: Sunday 2026-04-05 (end of W14) is also W14", () => {
    expect(getISOWeek("2026-04-05")).toBe(14)
  })
})

// ===========================================================================
// Tests: getMondayOfISOWeek
// ===========================================================================

describe("getMondayOfISOWeek", () => {
  it("W1 2026 starts on 2025-12-29 (Monday)", () => {
    expect(getMondayOfISOWeek(1, 2026)).toBe("2025-12-29")
  })
  it("W1 2024 starts on 2024-01-01", () => {
    expect(getMondayOfISOWeek(1, 2024)).toBe("2024-01-01")
  })
  it("W1 2025 starts on 2024-12-30", () => {
    expect(getMondayOfISOWeek(1, 2025)).toBe("2024-12-30")
  })
  it("W53 2015 starts on 2015-12-28", () => {
    expect(getMondayOfISOWeek(53, 2015)).toBe("2015-12-28")
  })
  it("round-trip: getMondayOfISOWeek(getISOWeek(date), year) returns Monday of that week", () => {
    const date = "2026-01-05"
    const week = getISOWeek(date)
    const year = new Date(date + "T12:00:00").getFullYear()
    expect(getMondayOfISOWeek(week, year)).toBe("2026-01-05")
  })
})

// ===========================================================================
// Tests: addDays
// ===========================================================================

describe("addDays", () => {
  it("crosses month boundary: 2026-01-31 + 1 = 2026-02-01", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01")
  })
  it("crosses year boundary: 2026-12-31 + 1 = 2027-01-01", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
  })
  it("subtracts across month boundary: 2026-03-01 - 1 = 2026-02-28", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
  })
  it("zero days: returns same date", () => {
    expect(addDays("2026-05-14", 0)).toBe("2026-05-14")
  })
  it("positive multi-day: 2026-05-14 + 7 = 2026-05-21", () => {
    expect(addDays("2026-05-14", 7)).toBe("2026-05-21")
  })
  it("crosses DST spring-forward (US): 2026-03-07 + 1 = 2026-03-08", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08")
  })
})

// ===========================================================================
// Tests: getMondayOfWeek
// ===========================================================================

describe("getMondayOfWeek", () => {
  // Week of Mon 2026-05-11 through Sun 2026-05-17
  const EXPECTED_MONDAY = "2026-05-11"

  const daysOfWeek: Array<[string, Date]> = [
    ["Monday    2026-05-11", new Date("2026-05-11T12:00:00")],
    ["Tuesday   2026-05-12", new Date("2026-05-12T12:00:00")],
    ["Wednesday 2026-05-13", new Date("2026-05-13T12:00:00")],
    ["Thursday  2026-05-14", new Date("2026-05-14T12:00:00")],
    ["Friday    2026-05-15", new Date("2026-05-15T12:00:00")],
    ["Saturday  2026-05-16", new Date("2026-05-16T12:00:00")],
    ["Sunday    2026-05-17", new Date("2026-05-17T12:00:00")],
  ]

  for (const [label, date] of daysOfWeek) {
    it(`${label} → Monday ${EXPECTED_MONDAY}`, () => {
      expect(getMondayOfWeek(date)).toBe(EXPECTED_MONDAY)
    })
  }

  it("Monday itself is returned unchanged", () => {
    expect(getMondayOfWeek(new Date("2026-01-05T12:00:00"))).toBe("2026-01-05")
  })
})

// ===========================================================================
// Tests: calcHours
// ===========================================================================

describe("calcHours", () => {
  it("08:00–16:00 break=30 → 7.5 hours", () => {
    expect(calcHours("08:00", "16:00", 30)).toBe(7.5)
  })
  it("08:00–16:00 break=0 → 8 hours", () => {
    expect(calcHours("08:00", "16:00", 0)).toBe(8)
  })
  it("09:00–17:00 break=30 → 7.5 hours", () => {
    expect(calcHours("09:00", "17:00", 30)).toBe(7.5)
  })
  it("07:00–14:00 break=0 → 7 hours", () => {
    expect(calcHours("07:00", "14:00", 0)).toBe(7)
  })
  it("12:00–20:00 break=30 → 7.5 hours", () => {
    expect(calcHours("12:00", "20:00", 30)).toBe(7.5)
  })
  it("14:00–22:00 break=30 → 7.5 hours", () => {
    expect(calcHours("14:00", "22:00", 30)).toBe(7.5)
  })
  it("08:00–13:00 break=0 → 5 hours", () => {
    expect(calcHours("08:00", "13:00", 0)).toBe(5)
  })
  it("half-hour shift: 10:00–10:30 break=0 → 0.5 hours", () => {
    expect(calcHours("10:00", "10:30", 0)).toBe(0.5)
  })
  it("break larger than shift clamps to 0", () => {
    expect(calcHours("09:00", "10:00", 90)).toBe(0)
  })
})

// ===========================================================================
// Tests: orgSettings
// ===========================================================================

describe("orgSettings", () => {
  it("getOrgSettings returns default: 7 days", () => {
    expect(getOrgSettings().hours).toHaveLength(7)
  })
  it("default: Mon–Fri open 07:00–21:00", () => {
    const { hours } = getOrgSettings()
    for (let i = 0; i < 5; i++) {
      expect(hours[i].isOpen).toBe(true)
      expect(hours[i].openTime).toBe("07:00")
      expect(hours[i].closeTime).toBe("21:00")
    }
  })
  it("default: Saturday open 09:00–17:00", () => {
    const sat = getOrgSettings().hours[5]
    expect(sat.isOpen).toBe(true)
    expect(sat.openTime).toBe("09:00")
    expect(sat.closeTime).toBe("17:00")
  })
  it("default: Sunday closed", () => {
    expect(getOrgSettings().hours[6].isOpen).toBe(false)
  })
  it("getOrgSettings returns a defensive copy — mutations do not affect internal state", () => {
    const s1 = getOrgSettings()
    s1.hours[0].isOpen = false
    const s2 = getOrgSettings()
    expect(s2.hours[0].isOpen).toBe(true)
  })
  it("updateOrgSettings patches the hours array", () => {
    const newHours = getOrgSettings().hours.map((h) => ({ ...h, isOpen: false }))
    updateOrgSettings({ hours: newHours })
    expect(getOrgSettings().hours.every((h) => !h.isOpen)).toBe(true)
  })
  it("updateOrgSettings: patch is shallow-merged, unrelated keys survive", () => {
    updateOrgSettings({ hours: getOrgSettings().hours })
    expect(getOrgSettings().hours).toHaveLength(7)
  })
  it("updateOrgSettings: the patched value is itself a copy (internal mutation-safe)", () => {
    const hours = getOrgSettings().hours
    hours[0].openTime = "99:99"
    expect(getOrgSettings().hours[0].openTime).not.toBe("99:99")
  })
})
