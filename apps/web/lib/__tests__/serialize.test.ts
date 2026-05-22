import { describe, it, expect } from "vitest"
import { serEmployee, serShift, serSchedule, serOrg, serJobRole, serShiftTemplate } from "@/lib/serialize"

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-05-15T10:00:00.000Z")
const LATER = new Date("2026-05-15T12:00:00.000Z")

function makeDecimal(n: number) {
  return { toNumber: () => n }
}

// ===========================================================================
// Tests: serEmployee
// ===========================================================================

describe("serEmployee", () => {
  const base = {
    id: "emp-1",
    organizationId: "org-1",
    userId: null,
    name: "Sarah Chen",
    email: "sarah@example.com",
    phone: "+4512345678",
    jobRole: "Barista",
    hourlyWage: makeDecimal(14.5),
    employmentType: "FULL_TIME",
    contractedHours: 40,
    notes: null,
    isActive: true,
    inviteToken: null,
    inviteExpiry: null,
    createdAt: NOW,
    updatedAt: LATER,
  }

  it("converts Prisma Decimal to number", () => {
    expect(serEmployee(base).hourlyWage).toBe(14.5)
  })

  it("accepts a plain number hourlyWage (non-Decimal path)", () => {
    expect(serEmployee({ ...base, hourlyWage: 14.5 }).hourlyWage).toBe(14.5)
  })

  it("converts createdAt Date to ISO string", () => {
    expect(serEmployee(base).createdAt).toBe(NOW.toISOString())
  })

  it("converts updatedAt Date to ISO string", () => {
    expect(serEmployee(base).updatedAt).toBe(LATER.toISOString())
  })

  it("inviteExpiry null stays null", () => {
    expect(serEmployee(base).inviteExpiry).toBeNull()
  })

  it("inviteExpiry Date is converted to ISO string", () => {
    const expiry = new Date("2026-06-01T00:00:00.000Z")
    expect(serEmployee({ ...base, inviteExpiry: expiry }).inviteExpiry).toBe(expiry.toISOString())
  })

  it("preserves all scalar fields unchanged", () => {
    const result = serEmployee(base)
    expect(result.id).toBe("emp-1")
    expect(result.name).toBe("Sarah Chen")
    expect(result.email).toBe("sarah@example.com")
    expect(result.phone).toBe("+4512345678")
    expect(result.jobRole).toBe("Barista")
    expect(result.employmentType).toBe("FULL_TIME")
    expect(result.contractedHours).toBe(40)
    expect(result.isActive).toBe(true)
    expect(result.inviteToken).toBeNull()
  })
})

// ===========================================================================
// Tests: serShift
// ===========================================================================

describe("serShift", () => {
  const base = {
    id: "shift-1",
    scheduleId: "sched-1",
    organizationId: "org-1",
    employeeId: "emp-1",
    date: new Date("2026-05-11T00:00:00.000Z"),
    startTime: "08:00",
    endTime: "16:00",
    breakMinutes: 30,
    jobRole: "Barista",
    notes: "Opening shift",
    colorTag: "blue",
    createdAt: NOW,
    updatedAt: LATER,
  }

  it("converts date Date to YYYY-MM-DD string (drops time)", () => {
    expect(serShift(base).date).toBe("2026-05-11")
  })

  it("does not include employee key when employee is not provided", () => {
    expect(serShift(base)).not.toHaveProperty("employee")
  })

  it("serializes nested employee when provided (embedded shape only)", () => {
    const employee = { id: "emp-1", name: "Sarah Chen", jobRole: "Barista" }
    const result = serShift({ ...base, employee })
    expect(result.employee?.id).toBe("emp-1")
    expect(result.employee?.name).toBe("Sarah Chen")
    expect(result.employee?.jobRole).toBe("Barista")
  })

  it("preserves scalar fields", () => {
    const result = serShift(base)
    expect(result.startTime).toBe("08:00")
    expect(result.endTime).toBe("16:00")
    expect(result.breakMinutes).toBe(30)
    expect(result.jobRole).toBe("Barista")
    expect(result.notes).toBe("Opening shift")
    expect(result.colorTag).toBe("blue")
  })
})

// ===========================================================================
// Tests: serSchedule
// ===========================================================================

describe("serSchedule", () => {
  const base = {
    id: "sched-1",
    organizationId: "org-1",
    weekStart: new Date("2026-05-11T00:00:00.000Z"),
    isDuplicate: false,
    sourceScheduleId: null,
    publishedAt: null,
    createdAt: NOW,
    updatedAt: LATER,
  }

  it("converts weekStart Date to YYYY-MM-DD", () => {
    expect(serSchedule(base).weekStart).toBe("2026-05-11")
  })

  it("does not include shifts key when shifts are not provided", () => {
    expect(serSchedule(base)).not.toHaveProperty("shifts")
  })

  it("includes an empty shifts array when provided as empty", () => {
    expect(serSchedule({ ...base, shifts: [] }).shifts).toEqual([])
  })

  it("serializes nested shifts when provided", () => {
    const shift = {
      id: "shift-1",
      scheduleId: "sched-1",
      organizationId: "org-1",
      employeeId: "emp-1",
      date: new Date("2026-05-11T00:00:00.000Z"),
      startTime: "08:00",
      endTime: "16:00",
      breakMinutes: 0,
      jobRole: "Barista",
      notes: null,
      colorTag: null,
      createdAt: NOW,
      updatedAt: LATER,
    }
    const result = serSchedule({ ...base, shifts: [shift] })
    expect(result.shifts).toHaveLength(1)
    expect(result.shifts![0].date).toBe("2026-05-11")
  })
})

// ===========================================================================
// Tests: serOrg
// ===========================================================================

describe("serOrg", () => {
  const base = {
    id: "org-1",
    name: "The Daily Grind",
    slug: "the-daily-grind",
    currency: "DKK",
    subscriptionStatus: "ACTIVE",
    createdAt: NOW,
    updatedAt: LATER,
  }

  it("converts createdAt/updatedAt to ISO strings", () => {
    const result = serOrg(base)
    expect(result.createdAt).toBe(NOW.toISOString())
    expect(result.updatedAt).toBe(LATER.toISOString())
  })

  it("preserves scalar fields", () => {
    const result = serOrg(base)
    expect(result.id).toBe("org-1")
    expect(result.name).toBe("The Daily Grind")
    expect(result.slug).toBe("the-daily-grind")
    expect(result.subscriptionStatus).toBe("ACTIVE")
  })
})

// ===========================================================================
// Tests: serJobRole
// ===========================================================================

describe("serJobRole", () => {
  const base = {
    id: "role-1",
    organizationId: "org-1",
    name: "Barista",
    color: "blue",
    createdAt: NOW,
    updatedAt: LATER,
  }

  it("converts timestamps to ISO strings", () => {
    const result = serJobRole(base)
    expect(result.createdAt).toBe(NOW.toISOString())
    expect(result.updatedAt).toBe(LATER.toISOString())
  })

  it("preserves all fields", () => {
    const result = serJobRole(base)
    expect(result.id).toBe("role-1")
    expect(result.name).toBe("Barista")
    expect(result.color).toBe("blue")
  })
})

// ===========================================================================
// Tests: serShiftTemplate
// ===========================================================================

describe("serShiftTemplate", () => {
  const base = {
    id: "tmpl-1",
    organizationId: "org-1",
    name: "Morning",
    startTime: "07:00",
    endTime: "15:00",
    breakMinutes: 30,
    jobRole: "Barista",
    colorTag: "blue",
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: LATER,
  }

  it("converts timestamps to ISO strings", () => {
    const result = serShiftTemplate(base)
    expect(result.createdAt).toBe(NOW.toISOString())
    expect(result.updatedAt).toBe(LATER.toISOString())
  })

  it("preserves all fields including nullable colorTag", () => {
    const result = serShiftTemplate(base)
    expect(result.name).toBe("Morning")
    expect(result.startTime).toBe("07:00")
    expect(result.endTime).toBe("15:00")
    expect(result.breakMinutes).toBe(30)
    expect(result.colorTag).toBe("blue")
    expect(result.sortOrder).toBe(0)
  })

  it("colorTag null stays null", () => {
    expect(serShiftTemplate({ ...base, colorTag: null }).colorTag).toBeNull()
  })
})
