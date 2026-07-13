/**
 * Tests for the payroll timesheet CSV export — hours aggregation must be
 * correct because this output feeds directly into what employees get paid.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import { getTimesheetCsv } from "@/lib/services/timesheetService"
import { ServiceError } from "@/lib/services/errors"

vi.mock("@/lib/prisma", () => ({
  db: {
    organization: { findUnique: vi.fn() },
    shift: { findMany: vi.fn() },
    timeEntry: { findMany: vi.fn() },
  },
}))

const mockOrg = vi.mocked(db.organization.findUnique)
const mockShifts = vi.mocked(db.shift.findMany)
const mockEntries = vi.mocked(db.timeEntry.findMany)

const employee = {
  id: "emp1",
  name: "Anna Jensen",
  email: "anna@example.com",
  jobRole: "Barista",
  employmentType: "PART_TIME",
  contractedHours: 20,
  hourlyWage: 140,
}

function shift(date: string, startTime: string, endTime: string, breakMinutes = 0, emp = employee) {
  return {
    date: new Date(date + "T00:00:00Z"),
    startTime,
    endTime,
    breakMinutes,
    notes: null,
    employee: emp,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockOrg.mockResolvedValue({ currency: "DKK", timezone: "Europe/Copenhagen" } as never)
})

function parseCsv(csv: string): string[][] {
  return csv.split("\n").map((line) =>
    line.split(",").map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"')),
  )
}

describe("scheduled summary", () => {
  it("aggregates hours, days and pay per employee", async () => {
    mockShifts.mockResolvedValue([
      shift("2026-07-06", "08:00", "16:00", 30), // 7.5h
      shift("2026-07-07", "10:00", "14:00"), // 4h
    ] as never)

    const csv = await getTimesheetCsv("org1", "2026-07-06", "2026-07-12", "scheduled", "summary")
    const rows = parseCsv(csv)

    expect(rows[0]).toEqual([
      "Employee", "Email", "Job Role", "Employment Type", "Contracted Hours",
      "Days Worked", "Hours", "Hourly Wage (DKK)", "Total Pay (DKK)",
    ])
    expect(rows).toHaveLength(2)
    // 11.5h × 140 = 1610
    expect(rows[1]).toEqual([
      "Anna Jensen", "anna@example.com", "Barista", "PART_TIME", "20",
      "2", "11.5", "140", "1610",
    ])
  })

  it("excludes sick shifts via the query filter", async () => {
    mockShifts.mockResolvedValue([] as never)
    await getTimesheetCsv("org1", "2026-07-06", "2026-07-12", "scheduled", "summary")
    expect(mockShifts).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ colorTag: { not: "sick" } }),
      }),
    )
  })
})

describe("scheduled detail", () => {
  it("emits one row per shift with per-row pay, sorted by employee then date", async () => {
    const bob = { ...employee, id: "emp2", name: "Bob Berg", hourlyWage: 150 }
    mockShifts.mockResolvedValue([
      shift("2026-07-07", "10:00", "14:00", 0, bob), // 4h × 150 = 600
      shift("2026-07-06", "08:00", "16:00", 30), // 7.5h × 140 = 1050
    ] as never)

    const csv = await getTimesheetCsv("org1", "2026-07-06", "2026-07-12", "scheduled", "detail")
    const rows = parseCsv(csv)

    expect(rows).toHaveLength(3)
    expect(rows[1]).toEqual([
      "Anna Jensen", "2026-07-06", "08:00", "16:00", "30", "7.5", "140", "1050", "",
    ])
    expect(rows[2]).toEqual([
      "Bob Berg", "2026-07-07", "10:00", "14:00", "0", "4", "150", "600", "",
    ])
  })
})

describe("clocked", () => {
  it("computes net hours from clock in/out minus break, in the org timezone", async () => {
    mockEntries.mockResolvedValue([
      {
        // 08:00–16:00 Copenhagen summer time (UTC+2)
        clockIn: new Date("2026-07-06T06:00:00Z"),
        clockOut: new Date("2026-07-06T14:00:00Z"),
        breakMinutes: 30,
        note: "covered rush",
        employee,
      },
    ] as never)

    const csv = await getTimesheetCsv("org1", "2026-07-06", "2026-07-12", "clocked", "detail")
    const rows = parseCsv(csv)

    expect(rows[1]).toEqual([
      "Anna Jensen", "2026-07-06", "08:00", "16:00", "30", "7.5", "140", "1050", "covered rush",
    ])
  })

  it("only queries completed entries", async () => {
    mockEntries.mockResolvedValue([] as never)
    await getTimesheetCsv("org1", "2026-07-06", "2026-07-12", "clocked", "summary")
    expect(mockEntries).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clockOut: { not: null } }),
      }),
    )
  })
})

describe("validation", () => {
  it("rejects an inverted date range", async () => {
    await expect(
      getTimesheetCsv("org1", "2026-07-12", "2026-07-06", "scheduled", "summary"),
    ).rejects.toThrow(ServiceError)
  })

  it("rejects ranges longer than a year", async () => {
    await expect(
      getTimesheetCsv("org1", "2025-01-01", "2026-07-06", "scheduled", "summary"),
    ).rejects.toThrow(ServiceError)
  })
})
