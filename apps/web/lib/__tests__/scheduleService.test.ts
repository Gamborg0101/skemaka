/**
 * Tests for the scheduling overlap/block rule and week-creation race handling.
 *
 * The authoritative "one shift per employee per date" block lives in
 * createShift — the timeline's client-side guard is only UX; the server is the
 * real gate. These tests pin that behaviour (and the published-week → draft
 * reset + late-add email) against a mocked Prisma client, following the same
 * mocking pattern as billingService.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import { sendShiftAssignedEmail } from "@/lib/resend"
import { Prisma } from "@/app/generated/prisma/client"
import { createShift, updateShift, getOrCreateSchedule } from "@/lib/services/scheduleService"

vi.mock("@/lib/prisma", () => ({
  db: {
    employee: { findFirst: vi.fn(), findUnique: vi.fn() },
    shift: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    schedule: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    schedulingEvent: { create: vi.fn() },
  },
}))

// scheduleService imports these at module load; stub them so no real Resend /
// Twilio client is constructed and no notification actually fires.
// Returns a resolved promise: createShift fires it with `.catch(...)`, so the
// mock must be thenable or the fire-and-forget send throws.
vi.mock("@/lib/resend", () => ({ sendShiftAssignedEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@/lib/sms", () => ({
  sendSchedulePublishedSms: vi.fn(),
  sendShiftAssignedSms: vi.fn(),
  sendShiftCancelledSms: vi.fn(),
  sendShiftUpdatedSms: vi.fn(),
}))
vi.mock("@/lib/push", () => ({ sendPushToUsers: vi.fn().mockResolvedValue(0) }))

const mockEmpFindFirst = vi.mocked(db.employee.findFirst)
const mockShiftFindFirst = vi.mocked(db.shift.findFirst)
const mockShiftCreate = vi.mocked(db.shift.create)
const mockShiftUpdate = vi.mocked(db.shift.update)
const mockSchedFindFirst = vi.mocked(db.schedule.findFirst)
const mockSchedCreate = vi.mocked(db.schedule.create)
const mockUpdateMany = vi.mocked(db.schedule.updateMany)
const mockEventCreate = vi.mocked(db.schedulingEvent.create)
const mockSendEmail = vi.mocked(sendShiftAssignedEmail)

const ORG = "org_1"
const DATE = "2026-06-15"

/** A fully-populated Prisma shift row as db.shift.create would return it. */
function shiftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "shift_1",
    scheduleId: "sched_1",
    organizationId: ORG,
    employeeId: "emp_1",
    date: new Date(DATE + "T00:00:00Z"),
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 30,
    jobRole: "Server",
    notes: null,
    colorTag: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  }
}

const EMPLOYEE = { id: "emp_1", name: "Ada", email: "ada@example.com", organization: { name: "Cafe" } }

beforeEach(() => {
  vi.clearAllMocks()
  // Defaults for the happy path; individual tests override as needed.
  mockEmpFindFirst.mockResolvedValue(EMPLOYEE as never)
  mockShiftFindFirst.mockResolvedValue(null as never)
  mockSchedFindFirst.mockResolvedValue({ publishedAt: null } as never)
  mockShiftCreate.mockResolvedValue(shiftRow() as never)
  mockUpdateMany.mockResolvedValue({ count: 0 } as never)
  mockEventCreate.mockResolvedValue({} as never)
})

const INPUT = {
  employeeId: "emp_1",
  date: DATE,
  startTime: "09:00",
  endTime: "17:00",
  breakMinutes: 30,
  jobRole: "Server",
}

describe("createShift — overlap/block rule", () => {
  it("blocks with CONFLICT when the employee already has a shift on that date", async () => {
    mockShiftFindFirst.mockResolvedValue({ id: "shift_existing" } as never)

    await expect(createShift(ORG, "sched_1", INPUT)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This employee already has a shift on this date",
    })
    expect(mockShiftCreate).not.toHaveBeenCalled()
  })

  it("queries the block by the given employee + date (guards the double-book check)", async () => {
    await createShift(ORG, "sched_1", INPUT)

    expect(mockShiftFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG,
          employeeId: "emp_1",
          date: new Date(DATE + "T00:00:00Z"),
          cancelledAt: null,
        },
      }),
    )
  })

  it("throws NOT_FOUND when the employee is not in the org", async () => {
    mockEmpFindFirst.mockResolvedValue(null as never)

    await expect(createShift(ORG, "sched_1", INPUT)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Employee not found",
    })
    expect(mockShiftCreate).not.toHaveBeenCalled()
  })

  it("creates the shift and returns it serialized when the slot is free", async () => {
    const result = await createShift(ORG, "sched_1", INPUT)

    expect(mockShiftCreate).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      id: "shift_1",
      employeeId: "emp_1",
      date: DATE, // Date → YYYY-MM-DD via serShift
      startTime: "09:00",
      endTime: "17:00",
      jobRole: "Server",
    })
    expect(typeof result.createdAt).toBe("string")
  })
})

describe("createShift — draft/notify-now side effects", () => {
  it("does NOT email the employee for a default (draft) add", async () => {
    await createShift(ORG, "sched_1", INPUT)

    expect(mockSendEmail).not.toHaveBeenCalled()
    // Nothing ever reverts a week to draft anymore.
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it("notifyNow publishes the shift immediately and emails the employee", async () => {
    await createShift(ORG, "sched_1", { ...INPUT, notifyNow: true })

    expect(mockShiftCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ publishedAt: expect.any(Date) }) }),
    )
    expect(mockSendEmail).toHaveBeenCalledOnce()
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ada@example.com", jobRole: "Server", startTime: "09:00", endTime: "17:00" }),
    )
  })
})

describe("getOrCreateSchedule — creation + race handling", () => {
  const existingSchedule = {
    id: "sched_existing",
    organizationId: ORG,
    weekStart: new Date(DATE + "T00:00:00Z"),
    isDuplicate: false,
    sourceScheduleId: null,
    publishedAt: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    shifts: [],
  }

  it("returns the existing schedule without creating (created: false)", async () => {
    mockSchedFindFirst.mockResolvedValue(existingSchedule as never)

    const { schedule, created } = await getOrCreateSchedule(ORG, DATE)

    expect(created).toBe(false)
    expect(schedule.id).toBe("sched_existing")
    expect(mockSchedCreate).not.toHaveBeenCalled()
  })

  it("creates a new schedule when none exists (created: true)", async () => {
    mockSchedFindFirst.mockResolvedValue(null as never)
    mockSchedCreate.mockResolvedValue({ ...existingSchedule, id: "sched_new" } as never)

    const { schedule, created } = await getOrCreateSchedule(ORG, DATE)

    expect(created).toBe(true)
    expect(schedule.id).toBe("sched_new")
    expect(mockSchedCreate).toHaveBeenCalledOnce()
  })

  it("recovers from a concurrent-create race (P2002) by returning the winner's row", async () => {
    // First lookup misses, create loses the unique-constraint race, second
    // lookup finds the row the concurrent request inserted.
    mockSchedFindFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(existingSchedule as never)
    mockSchedCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "test",
      }),
    )

    const { schedule, created } = await getOrCreateSchedule(ORG, DATE)

    expect(created).toBe(false)
    expect(schedule.id).toBe("sched_existing")
  })

  it("rethrows a non-P2002 database error", async () => {
    mockSchedFindFirst.mockResolvedValue(null as never)
    mockSchedCreate.mockRejectedValue(new Error("connection reset"))

    await expect(getOrCreateSchedule(ORG, DATE)).rejects.toThrow("connection reset")
  })
})

describe("updateShift — overlap/block rule on move & reassign", () => {
  // The shift being edited, as db.shift.findFirst returns it (with the includes
  // updateShift reads). emp_1 works 2026-06-15.
  function existingShift(overrides: Record<string, unknown> = {}) {
    return {
      id: "shift_1",
      employeeId: "emp_1",
      date: new Date(DATE + "T00:00:00Z"),
      startTime: "09:00",
      endTime: "17:00",
      employee: { name: "Ada", phone: null },
      organization: { name: "Cafe" },
      schedule: { publishedAt: null },
      ...overrides,
    }
  }

  it("blocks with CONFLICT when moving the shift onto a day the employee already works", async () => {
    mockShiftFindFirst
      .mockResolvedValueOnce(existingShift() as never) // the shift being edited
      .mockResolvedValueOnce({ id: "shift_other" } as never) // the clashing shift
    mockShiftUpdate.mockResolvedValue(shiftRow() as never)

    await expect(updateShift(ORG, "sched_1", "shift_1", { date: "2026-06-16" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This employee already has a shift on this date",
    })
    expect(mockShiftUpdate).not.toHaveBeenCalled()
  })

  it("blocks with CONFLICT when reassigning to an employee who already works that date", async () => {
    mockEmpFindFirst.mockResolvedValue({ id: "emp_2" } as never) // target employee exists
    mockShiftFindFirst
      .mockResolvedValueOnce(existingShift() as never)
      .mockResolvedValueOnce({ id: "shift_other" } as never)
    mockShiftUpdate.mockResolvedValue(shiftRow() as never)

    await expect(updateShift(ORG, "sched_1", "shift_1", { employeeId: "emp_2" })).rejects.toMatchObject({
      code: "CONFLICT",
    })
    expect(mockShiftUpdate).not.toHaveBeenCalled()
  })

  it("excludes the shift itself from the clash query (queries id: { not })", async () => {
    mockShiftFindFirst
      .mockResolvedValueOnce(existingShift() as never)
      .mockResolvedValueOnce(null as never)
    mockShiftUpdate.mockResolvedValue(shiftRow() as never)

    await updateShift(ORG, "sched_1", "shift_1", { date: "2026-06-16" })

    expect(mockShiftFindFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG,
          employeeId: "emp_1",
          date: new Date("2026-06-16T00:00:00Z"),
          id: { not: "shift_1" },
          cancelledAt: null,
        },
      }),
    )
  })

  it("allows a move to a free day (no clashing shift)", async () => {
    mockShiftFindFirst
      .mockResolvedValueOnce(existingShift() as never)
      .mockResolvedValueOnce(null as never)
    mockShiftUpdate.mockResolvedValue(shiftRow({ date: new Date("2026-06-16T00:00:00Z") }) as never)

    const result = await updateShift(ORG, "sched_1", "shift_1", { date: "2026-06-16" })

    expect(mockShiftUpdate).toHaveBeenCalledOnce()
    expect(result.date).toBe("2026-06-16")
  })

  it("skips the clash query entirely for a timing-only edit", async () => {
    mockShiftFindFirst.mockResolvedValueOnce(existingShift() as never)
    mockShiftUpdate.mockResolvedValue(shiftRow() as never)

    await updateShift(ORG, "sched_1", "shift_1", { startTime: "10:00" })

    // Only the initial "load the shift" lookup — no second clash query.
    expect(mockShiftFindFirst).toHaveBeenCalledOnce()
    expect(mockShiftUpdate).toHaveBeenCalledOnce()
  })
})
