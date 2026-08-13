/**
 * Per-shift draft/publish semantics (Planday-style).
 *
 * New shifts are private drafts (publishedAt null) until rolled out — creating
 * or editing them is silent. Touching an already-rolled-out shift is live news
 * for the person on it, so it notifies immediately and the shift STAYS
 * published; nothing ever reverts a week to draft anymore. "Notify now" (the
 * ad-hoc case) publishes a single new shift instantly. Sick days are records,
 * not plans: born published, never announced.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import {
  sendShiftUpdatedSms,
  sendShiftCancelledSms,
  sendShiftAssignedSms,
} from "@/lib/sms"
import { sendShiftAssignedEmail } from "@/lib/resend"
import { createShift, updateShift, deleteShift } from "@/lib/services/scheduleService"

// `$transaction` hands the same client to the callback (createShift and a
// move/reassign now wrap their clash check plus write in one locked
// transaction); `$queryRaw` stands in for that lock's SELECT … FOR UPDATE.
vi.mock("@/lib/prisma", () => {
  const client = {
    shift: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    schedule: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    employee: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    schedulingEvent: {
      create: vi.fn().mockReturnValue({ catch: vi.fn() }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(client)),
    $queryRaw: vi.fn(async () => [{ id: "emp_1" }]),
  }
  return { db: client }
})

vi.mock("@/lib/sms", () => ({
  sendShiftUpdatedSms: vi.fn(),
  sendShiftCancelledSms: vi.fn(),
  sendShiftAssignedSms: vi.fn(),
  sendSchedulePublishedSms: vi.fn(),
  sendRollOutSms: vi.fn(),
}))

vi.mock("@/lib/resend", () => ({
  sendShiftAssignedEmail: vi.fn().mockReturnValue({ catch: vi.fn() }),
  sendShiftCancelledEmail: vi.fn().mockReturnValue({ catch: vi.fn() }),
  sendShiftsRolledOutEmail: vi.fn().mockReturnValue({ catch: vi.fn() }),
}))

vi.mock("@/lib/push", () => ({ sendPushToUsers: vi.fn().mockResolvedValue(0) }))

// These tests assert on DB writes and notification side-effects, not the
// serialized response shape, so an identity serializer keeps fixtures minimal.
vi.mock("@/lib/serialize", () => ({
  serShift: (s: unknown) => s,
  serSchedule: (s: unknown) => s,
  serEmployee: (s: unknown) => s,
}))

const ORG = "org_1"
const SCHEDULE = "sched_1"
const SHIFT = "shift_1"

function shiftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SHIFT,
    scheduleId: SCHEDULE,
    organizationId: ORG,
    employeeId: "emp_1",
    date: new Date("2026-06-20T00:00:00Z"),
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 30,
    jobRole: "Barista",
    notes: null,
    colorTag: null,
    publishedAt: null,
    cancelledAt: null,
    employee: { name: "Sarah Chen", phone: "+15551234567", locale: null },
    organization: { name: "The Daily Grind", locale: null },
    ...overrides,
  }
}

const EMPLOYEE = {
  id: "emp_1",
  name: "Sarah Chen",
  email: "sarah@example.com",
  phone: "+15551234567",
  locale: null,
  organization: { name: "The Daily Grind", locale: null },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createShift — draft by default", () => {
  it("creates a private draft (publishedAt null) and notifies no one", async () => {
    vi.mocked(db.employee.findFirst).mockResolvedValue(EMPLOYEE as never)
    vi.mocked(db.shift.findFirst).mockResolvedValue(null as never)
    vi.mocked(db.shift.create).mockResolvedValue(shiftRow() as never)

    await createShift(ORG, SCHEDULE, {
      employeeId: "emp_1", date: "2026-06-20", startTime: "09:00", endTime: "17:00", jobRole: "Barista",
    })

    expect(db.shift.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ publishedAt: null }),
    }))
    // No week revert, ever.
    expect(db.schedule.updateMany).not.toHaveBeenCalled()
    expect(db.schedule.update).not.toHaveBeenCalled()
    expect(sendShiftAssignedEmail).not.toHaveBeenCalled()
    expect(sendShiftAssignedSms).not.toHaveBeenCalled()
  })

  it("notifyNow publishes the shift immediately and notifies the employee", async () => {
    vi.mocked(db.employee.findFirst).mockResolvedValue(EMPLOYEE as never)
    vi.mocked(db.shift.findFirst).mockResolvedValue(null as never)
    vi.mocked(db.shift.create).mockResolvedValue(shiftRow({ publishedAt: new Date() }) as never)

    await createShift(ORG, SCHEDULE, {
      employeeId: "emp_1", date: "2026-06-20", startTime: "09:00", endTime: "17:00", jobRole: "Barista",
      notifyNow: true,
    })

    expect(db.shift.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ publishedAt: expect.any(Date) }),
    }))
    expect(sendShiftAssignedEmail).toHaveBeenCalledTimes(1)
    expect(sendShiftAssignedSms).toHaveBeenCalledTimes(1)
  })

  it("sick days are born published but never announced", async () => {
    vi.mocked(db.employee.findFirst).mockResolvedValue(EMPLOYEE as never)
    vi.mocked(db.shift.findFirst).mockResolvedValue(null as never)
    vi.mocked(db.shift.create).mockResolvedValue(shiftRow({ colorTag: "sick" }) as never)

    await createShift(ORG, SCHEDULE, {
      employeeId: "emp_1", date: "2026-06-20", startTime: "00:00", endTime: "00:00", jobRole: "Sick Day",
      colorTag: "sick",
    })

    expect(db.shift.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ publishedAt: expect.any(Date) }),
    }))
    expect(sendShiftAssignedEmail).not.toHaveBeenCalled()
    expect(sendShiftAssignedSms).not.toHaveBeenCalled()
  })
})

describe("updateShift — notify-immediately for rolled-out shifts", () => {
  it("edits a draft silently", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(shiftRow({ publishedAt: null }) as never)
    vi.mocked(db.shift.update).mockResolvedValue(shiftRow() as never)

    await updateShift(ORG, SCHEDULE, SHIFT, { startTime: "10:00" })

    expect(db.schedule.update).not.toHaveBeenCalled()
    expect(sendShiftUpdatedSms).not.toHaveBeenCalled()
    expect(sendShiftAssignedSms).not.toHaveBeenCalled()
    expect(sendShiftCancelledSms).not.toHaveBeenCalled()
  })

  it("keeps a rolled-out shift published and texts the employee about the change", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(
      shiftRow({ publishedAt: new Date("2026-06-15T10:00:00Z") }) as never,
    )
    vi.mocked(db.shift.update).mockResolvedValue(shiftRow() as never)

    await updateShift(ORG, SCHEDULE, SHIFT, { startTime: "10:00" })

    // The week must NOT revert to draft, and the shift's publishedAt is untouched.
    expect(db.schedule.update).not.toHaveBeenCalled()
    expect(db.shift.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ publishedAt: expect.anything() }),
    }))
    expect(sendShiftUpdatedSms).toHaveBeenCalledTimes(1)
  })

  it("reassigning a rolled-out shift tells the old assignee and the new one", async () => {
    vi.mocked(db.shift.findFirst)
      .mockResolvedValueOnce(shiftRow({ publishedAt: new Date("2026-06-15T10:00:00Z") }) as never)
      // No second findFirst any more: the clash check is a findMany overlap
      // scan, defaulted to [] in the mock above. Leaving a queued Once here
      // leaked into the next test, which then saw a null shift.
    vi.mocked(db.employee.findFirst).mockResolvedValue({ id: "emp_2" } as never)
    vi.mocked(db.employee.findUnique).mockResolvedValue({ name: "Bob", phone: "+15559876543", locale: null } as never)
    vi.mocked(db.shift.update).mockResolvedValue(shiftRow({ employeeId: "emp_2" }) as never)

    await updateShift(ORG, SCHEDULE, SHIFT, { employeeId: "emp_2" })

    expect(sendShiftCancelledSms).toHaveBeenCalledTimes(1) // old assignee
    expect(sendShiftAssignedSms).toHaveBeenCalledTimes(1)  // new assignee
  })
})

describe("deleteShift — notify-immediately for rolled-out shifts", () => {
  it("deletes a draft silently", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(shiftRow({ publishedAt: null }) as never)
    vi.mocked(db.shift.delete).mockResolvedValue(shiftRow() as never)

    await deleteShift(ORG, SCHEDULE, SHIFT)

    expect(db.schedule.update).not.toHaveBeenCalled()
    expect(sendShiftCancelledSms).not.toHaveBeenCalled()
  })

  it("texts the employee when deleting a rolled-out shift", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(
      shiftRow({ publishedAt: new Date("2026-06-15T10:00:00Z") }) as never,
    )
    vi.mocked(db.shift.delete).mockResolvedValue(shiftRow() as never)

    await deleteShift(ORG, SCHEDULE, SHIFT)

    expect(db.schedule.update).not.toHaveBeenCalled()
    expect(sendShiftCancelledSms).toHaveBeenCalledTimes(1)
  })

  it("does not re-announce deleting an already-cancelled rolled-out shift", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(
      shiftRow({ publishedAt: new Date("2026-06-15T10:00:00Z"), cancelledAt: new Date() }) as never,
    )
    vi.mocked(db.shift.delete).mockResolvedValue(shiftRow() as never)

    await deleteShift(ORG, SCHEDULE, SHIFT)

    expect(sendShiftCancelledSms).not.toHaveBeenCalled()
  })
})
