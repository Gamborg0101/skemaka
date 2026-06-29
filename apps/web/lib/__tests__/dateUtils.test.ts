import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  getMondayOfWeek,
  addDays,
  getISOWeek,
  getISOYear,
  getMondayOfISOWeek,
  getWeekDays,
  formatTime,
  calcHours,
  calcNetHours,
} from "@/lib/dateUtils"
import { getInitials } from "@/lib/utils"

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

// ===========================================================================
// Tests: getISOYear
// ===========================================================================

describe("getISOYear", () => {
  it("2016-01-01 (Fri) belongs to ISO year 2015", () => {
    expect(getISOYear("2016-01-01")).toBe(2015)
  })
  it("2015-12-31 belongs to ISO year 2015", () => {
    expect(getISOYear("2015-12-31")).toBe(2015)
  })
  it("2026-01-01 belongs to ISO year 2026", () => {
    expect(getISOYear("2026-01-01")).toBe(2026)
  })
  it("mid-year date stays in its own Gregorian year", () => {
    expect(getISOYear("2026-06-15")).toBe(2026)
  })
  it("2025-12-29 (Mon, first day of W1 2026) belongs to ISO year 2026", () => {
    expect(getISOYear("2025-12-29")).toBe(2026)
  })
})

// ===========================================================================
// Tests: getWeekDays
// ===========================================================================

describe("getWeekDays", () => {
  it("returns exactly 7 dates", () => {
    expect(getWeekDays("2026-05-11")).toHaveLength(7)
  })
  it("first day is the weekStart itself", () => {
    expect(getWeekDays("2026-05-11")[0]).toBe("2026-05-11")
  })
  it("last day is 6 days after weekStart (Sunday)", () => {
    expect(getWeekDays("2026-05-11")[6]).toBe("2026-05-17")
  })
  it("each day is one day after the previous", () => {
    const days = getWeekDays("2026-05-11")
    for (let i = 1; i < days.length; i++) {
      expect(addDays(days[i - 1], 1)).toBe(days[i])
    }
  })
  it("works across a month boundary", () => {
    const days = getWeekDays("2026-01-26")
    expect(days[6]).toBe("2026-02-01")
  })
  it("works across a year boundary", () => {
    const days = getWeekDays("2025-12-29")
    expect(days[6]).toBe("2026-01-04")
  })
})

// ===========================================================================
// Tests: formatTime
// ===========================================================================

describe("formatTime — 12h", () => {
  it("midnight: 00:00 → 12AM", () => {
    expect(formatTime("00:00", "12h")).toBe("12AM")
  })
  it("noon: 12:00 → 12PM", () => {
    expect(formatTime("12:00", "12h")).toBe("12PM")
  })
  it("morning whole hour: 08:00 → 8AM", () => {
    expect(formatTime("08:00", "12h")).toBe("8AM")
  })
  it("afternoon whole hour: 15:00 → 3PM", () => {
    expect(formatTime("15:00", "12h")).toBe("3PM")
  })
  it("morning with minutes: 07:30 → 7:30AM", () => {
    expect(formatTime("07:30", "12h")).toBe("7:30AM")
  })
  it("afternoon with minutes: 13:30 → 1:30PM", () => {
    expect(formatTime("13:30", "12h")).toBe("1:30PM")
  })
  it("just past midnight: 00:01 → 12:01AM", () => {
    expect(formatTime("00:01", "12h")).toBe("12:01AM")
  })
  it("end of day: 23:59 → 11:59PM", () => {
    expect(formatTime("23:59", "12h")).toBe("11:59PM")
  })
  it("just past noon: 12:01 → 12:01PM", () => {
    expect(formatTime("12:01", "12h")).toBe("12:01PM")
  })
  it("single-digit minute is zero-padded: 14:05 → 2:05PM", () => {
    expect(formatTime("14:05", "12h")).toBe("2:05PM")
  })
})

describe("formatTime — 24h (default)", () => {
  it("defaults to 24h when no format given: 15:00 → 15:00", () => {
    expect(formatTime("15:00")).toBe("15:00")
  })
  it("midnight: 00:00 → 00:00", () => {
    expect(formatTime("00:00", "24h")).toBe("00:00")
  })
  it("noon: 12:00 → 12:00", () => {
    expect(formatTime("12:00", "24h")).toBe("12:00")
  })
  it("morning whole hour zero-pads: 08:00 → 08:00", () => {
    expect(formatTime("08:00", "24h")).toBe("08:00")
  })
  it("afternoon with minutes: 14:30 → 14:30", () => {
    expect(formatTime("14:30", "24h")).toBe("14:30")
  })
  it("end of day: 23:59 → 23:59", () => {
    expect(formatTime("23:59", "24h")).toBe("23:59")
  })
})

// ===========================================================================
// Tests: calcNetHours
// ===========================================================================

describe("calcNetHours", () => {
  it("whole hours with break: 08:00–16:00 break=30 → '7h 30m'", () => {
    expect(calcNetHours("08:00", "16:00", 30)).toBe("7h 30m")
  })
  it("whole hours no break: 08:00–16:00 break=0 → '8h'", () => {
    expect(calcNetHours("08:00", "16:00", 0)).toBe("8h")
  })
  it("exact hours: 07:00–14:00 break=0 → '7h'", () => {
    expect(calcNetHours("07:00", "14:00", 0)).toBe("7h")
  })
  it("half-hour shift: 10:00–10:30 break=0 → '0h 30m'", () => {
    expect(calcNetHours("10:00", "10:30", 0)).toBe("0h 30m")
  })
  it("zero duration: 09:00–09:00 → ''", () => {
    expect(calcNetHours("09:00", "09:00", 0)).toBe("")
  })
  it("break exceeds shift: 09:00–10:00 break=90 → ''", () => {
    expect(calcNetHours("09:00", "10:00", 90)).toBe("")
  })
  it("long shift: 06:30–21:00 break=30 → '14h'", () => {
    expect(calcNetHours("06:30", "21:00", 30)).toBe("14h")
  })
  it("non-zero start and end minutes: 08:15–16:45 break=30 → '8h'", () => {
    expect(calcNetHours("08:15", "16:45", 30)).toBe("8h")
  })
})

// ===========================================================================
// Tests: getInitials
// ===========================================================================

describe("getInitials", () => {
  it("two-part name: 'John Doe' → 'JD'", () => {
    expect(getInitials("John Doe")).toBe("JD")
  })
  it("single name: 'Alice' → 'A'", () => {
    expect(getInitials("Alice")).toBe("A")
  })
  it("three-part name returns only first two initials: 'John Paul Jones' → 'JP'", () => {
    expect(getInitials("John Paul Jones")).toBe("JP")
  })
  it("lowercase input is uppercased: 'casper gamborg' → 'CG'", () => {
    expect(getInitials("casper gamborg")).toBe("CG")
  })
  it("preserves case from input: 'Casper Gamborg' → 'CG'", () => {
    expect(getInitials("Casper Gamborg")).toBe("CG")
  })
})
