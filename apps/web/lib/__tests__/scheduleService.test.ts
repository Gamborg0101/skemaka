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

// createShift and a move/reassign in updateShift run their clash check and their
// write inside ONE transaction, with the employee's row locked, so the check
// cannot race a concurrent add. `$transaction` hands the same mock client to the
// callback, which keeps every db.shift.* assertion below unchanged, and
// `$queryRaw` stands in for the `SELECT … FOR UPDATE` the lock issues.
vi.mock("@/lib/prisma", () => {
  const client = {
    employee: { findFirst: vi.fn(), findUnique: vi.fn() },
    shift: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    schedule: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    schedulingEvent: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(client)),
    $queryRaw: vi.fn(async () => [{ id: "emp_1" }]),
  }
  return { db: client }
})

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
const mockShiftFindMany = vi.mocked(db.shift.findMany)
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
  // No neighbouring shifts by default — the clash check is an overlap scan now.
  mockShiftFindMany.mockResolvedValue([] as never)
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
  it("blocks with CONFLICT when the new shift OVERLAPS an existing one", async () => {
    // INPUT is 09:00–17:00; this one runs into it.
    mockShiftFindMany.mockResolvedValue([
      { id: "shift_existing", date: new Date(DATE + "T00:00:00Z"), startTime: "16:00", endTime: "20:00" },
    ] as never)

    await expect(createShift(ORG, "sched_1", INPUT)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This shift overlaps another shift for this employee",
    })
    expect(mockShiftCreate).not.toHaveBeenCalled()
  })

  it("ALLOWS a split shift — same employee, same day, no overlap", async () => {
    // The whole point of the rule change: a chef on lunch and again on dinner.
    mockShiftFindMany.mockResolvedValue([
      { id: "lunch", date: new Date(DATE + "T00:00:00Z"), startTime: "06:00", endTime: "08:00" },
    ] as never)

    await createShift(ORG, "sched_1", INPUT)

    expect(mockShiftCreate).toHaveBeenCalled()
  })

  it("catches an overnight shift on the PREVIOUS day running into this one", async () => {
    // Filed under the day before, 22:00–10:00, so it covers this 09:00 start.
    const prev = new Date(new Date(DATE + "T00:00:00Z").getTime() - 86_400_000)
    mockShiftFindMany.mockResolvedValue([
      { id: "overnight", date: prev, startTime: "22:00", endTime: "10:00" },
    ] as never)

    await expect(createShift(ORG, "sched_1", INPUT)).rejects.toMatchObject({ code: "CONFLICT" })
    expect(mockShiftCreate).not.toHaveBeenCalled()
  })

  it("scans the neighbouring days, not just the target date", async () => {
    // A shift can end on the following day, so the clash window is ±1 day.
    await createShift(ORG, "sched_1", INPUT)

    const day = new Date(DATE + "T00:00:00Z").getTime()
    expect(mockShiftFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG,
          employeeId: "emp_1",
          cancelledAt: null,
          date: { gte: new Date(day - 86_400_000), lte: new Date(day + 86_400_000) },
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

  it("blocks with CONFLICT when a move lands on top of another shift", async () => {
    mockShiftFindFirst.mockResolvedValueOnce(existingShift() as never)
    mockShiftFindMany.mockResolvedValue([
      { id: "shift_other", date: new Date("2026-06-16T00:00:00Z"), startTime: "08:00", endTime: "12:00" },
    ] as never)
    mockShiftUpdate.mockResolvedValue(shiftRow() as never)

    await expect(updateShift(ORG, "sched_1", "shift_1", { date: "2026-06-16" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This shift overlaps another shift for this employee",
    })
    expect(mockShiftUpdate).not.toHaveBeenCalled()
  })

  it("ALLOWS a move onto a day the employee already works, if the times do not overlap", async () => {
    mockShiftFindFirst.mockResolvedValueOnce(existingShift() as never)
    mockShiftFindMany.mockResolvedValue([
      { id: "shift_other", date: new Date("2026-06-16T00:00:00Z"), startTime: "18:00", endTime: "23:00" },
    ] as never)
    mockShiftUpdate.mockResolvedValue(shiftRow({ date: new Date("2026-06-16T00:00:00Z") }) as never)

    await updateShift(ORG, "sched_1", "shift_1", { date: "2026-06-16" })

    expect(mockShiftUpdate).toHaveBeenCalledOnce()
  })

  it("blocks with CONFLICT when reassigning to an employee who already works that date", async () => {
    mockEmpFindFirst.mockResolvedValue({ id: "emp_2" } as never) // target employee exists
    mockShiftFindFirst.mockResolvedValueOnce(existingShift() as never)
    mockShiftFindMany.mockResolvedValue([
      { id: "shift_other", date: new Date(DATE + "T00:00:00Z"), startTime: "08:00", endTime: "18:00" },
    ] as never)
    mockShiftUpdate.mockResolvedValue(shiftRow() as never)

    await expect(updateShift(ORG, "sched_1", "shift_1", { employeeId: "emp_2" })).rejects.toMatchObject({
      code: "CONFLICT",
    })
    expect(mockShiftUpdate).not.toHaveBeenCalled()
  })

  it("excludes the shift itself from the clash scan (queries id: { not })", async () => {
    mockShiftFindFirst.mockResolvedValueOnce(existingShift() as never)
    mockShiftUpdate.mockResolvedValue(shiftRow() as never)

    await updateShift(ORG, "sched_1", "shift_1", { date: "2026-06-16" })

    const day = new Date("2026-06-16T00:00:00Z").getTime()
    expect(mockShiftFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG,
          employeeId: "emp_1",
          id: { not: "shift_1" },
          cancelledAt: null,
          date: { gte: new Date(day - 86_400_000), lte: new Date(day + 86_400_000) },
        },
      }),
    )
  })

  it("allows a move to a free day (no clashing shift)", async () => {
    mockShiftFindFirst.mockResolvedValueOnce(existingShift() as never)
    mockShiftUpdate.mockResolvedValue(shiftRow({ date: new Date("2026-06-16T00:00:00Z") }) as never)

    const result = await updateShift(ORG, "sched_1", "shift_1", { date: "2026-06-16" })

    expect(mockShiftUpdate).toHaveBeenCalledOnce()
    expect(result.date).toBe("2026-06-16")
  })

  it("NOW checks a timing-only edit, which the one-per-day rule could skip", async () => {
    // Dragging dinner earlier can run it into lunch without the employee or the
    // date changing. Under the old rule that was impossible, so it was skipped.
    mockShiftFindFirst.mockResolvedValueOnce(existingShift() as never)
    mockShiftFindMany.mockResolvedValue([
      { id: "lunch", date: new Date(DATE + "T00:00:00Z"), startTime: "09:00", endTime: "11:00" },
    ] as never)

    await expect(
      updateShift(ORG, "sched_1", "shift_1", { startTime: "10:00" }),
    ).rejects.toMatchObject({ code: "CONFLICT" })

    expect(mockShiftFindMany).toHaveBeenCalled()
    expect(mockShiftUpdate).not.toHaveBeenCalled()
  })
})
