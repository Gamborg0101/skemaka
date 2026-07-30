/**
 * Cancel-shift semantics. Cancelling keeps the row (as a cancelled record),
 * never reverts a published schedule to draft, and notifies the affected
 * employee immediately (SMS + email + push) instead of relying on a
 * re-publish blast. Already-cancelled shifts and sick-day markers refuse.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import { sendShiftCancelledSms } from "@/lib/sms"
import { sendShiftCancelledEmail } from "@/lib/resend"
import { sendPushToUsers } from "@/lib/push"
import { cancelShift, updateShift, deleteShift } from "@/lib/services/scheduleService"

vi.mock("@/lib/prisma", () => ({
  db: {
    shift: {
      findFirst: vi.fn(),
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
  },
}))

vi.mock("@/lib/sms", () => ({
  sendShiftUpdatedSms: vi.fn(),
  sendShiftCancelledSms: vi.fn(),
  sendShiftAssignedSms: vi.fn(),
  sendSchedulePublishedSms: vi.fn(),
  sendRollOutSms: vi.fn(),
}))

vi.mock("@/lib/resend", () => ({
  sendShiftAssignedEmail: vi.fn().mockResolvedValue(undefined),
  sendShiftCancelledEmail: vi.fn().mockResolvedValue(undefined),
  sendShiftsRolledOutEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/push", () => ({
  sendPushToUsers: vi.fn().mockResolvedValue(0),
}))

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
    cancelledAt: null,
    // Cancel targets rolled-out shifts; drafts are guarded (deleted instead).
    publishedAt: new Date("2026-06-15T10:00:00Z"),
    employee: {
      name: "Sarah Chen",
      phone: "+15551234567",
      email: "sarah@example.com",
      userId: "user_1",
      locale: "en",
    },
    organization: { name: "The Daily Grind", locale: "en" },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("cancelShift", () => {
  it("sets cancelledAt, keeps the schedule published, and notifies via SMS + email + push", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(shiftRow() as never)
    vi.mocked(db.shift.update).mockResolvedValue(
      shiftRow({ cancelledAt: new Date() }) as never,
    )

    await cancelShift(ORG, SCHEDULE, SHIFT)

    expect(db.shift.update).toHaveBeenCalledWith({
      where: { id: SHIFT },
      data: { cancelledAt: expect.any(Date) },
    })
    // The whole point of cancel vs delete: the published week stands.
    expect(db.schedule.update).not.toHaveBeenCalled()
    expect(db.schedule.updateMany).not.toHaveBeenCalled()

    expect(sendShiftCancelledSms).toHaveBeenCalledTimes(1)
    expect(sendShiftCancelledEmail).toHaveBeenCalledTimes(1)
    expect(sendPushToUsers).toHaveBeenCalledWith(["user_1"], expect.objectContaining({ url: "/portal" }))
  })

  it("skips channels the employee doesn't have, but still cancels", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(
      shiftRow({
        employee: { name: "Sarah Chen", phone: null, email: null, userId: null, locale: null },
      }) as never,
    )
    vi.mocked(db.shift.update).mockResolvedValue(
      shiftRow({ cancelledAt: new Date() }) as never,
    )

    await cancelShift(ORG, SCHEDULE, SHIFT)

    expect(db.shift.update).toHaveBeenCalledTimes(1)
    expect(sendShiftCancelledSms).not.toHaveBeenCalled()
    expect(sendShiftCancelledEmail).not.toHaveBeenCalled()
    expect(sendPushToUsers).not.toHaveBeenCalled()
  })

  it("refuses an already-cancelled shift", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(
      shiftRow({ cancelledAt: new Date("2026-06-18T09:00:00Z") }) as never,
    )

    await expect(cancelShift(ORG, SCHEDULE, SHIFT)).rejects.toThrow("already cancelled")
    expect(db.shift.update).not.toHaveBeenCalled()
  })

  it("refuses a draft shift — drafts are deleted, not cancelled", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(
      shiftRow({ publishedAt: null }) as never,
    )

    await expect(cancelShift(ORG, SCHEDULE, SHIFT)).rejects.toThrow("Draft shifts")
    expect(db.shift.update).not.toHaveBeenCalled()
  })

  it("refuses a sick-day marker", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(
      shiftRow({ colorTag: "sick" }) as never,
    )

    await expect(cancelShift(ORG, SCHEDULE, SHIFT)).rejects.toThrow("Sick days")
    expect(db.shift.update).not.toHaveBeenCalled()
  })

  it("throws NOT_FOUND for a shift outside the org/schedule", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(null as never)

    await expect(cancelShift(ORG, SCHEDULE, SHIFT)).rejects.toThrow("Not found")
  })
})

describe("cancelled shifts stay read-only", () => {
  it("updateShift refuses a cancelled shift", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(
      shiftRow({
        cancelledAt: new Date("2026-06-18T09:00:00Z"),
        schedule: { publishedAt: null },
      }) as never,
    )

    await expect(updateShift(ORG, SCHEDULE, SHIFT, { startTime: "10:00" })).rejects.toThrow(
      "cannot be edited",
    )
    expect(db.shift.update).not.toHaveBeenCalled()
  })

  it("deleteShift removes a cancelled record without re-texting the employee", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(
      shiftRow({
        cancelledAt: new Date("2026-06-18T09:00:00Z"),
        schedule: { publishedAt: null },
      }) as never,
    )
    vi.mocked(db.shift.delete).mockResolvedValue(shiftRow() as never)

    await deleteShift(ORG, SCHEDULE, SHIFT)

    expect(db.shift.delete).toHaveBeenCalledTimes(1)
    expect(sendShiftCancelledSms).not.toHaveBeenCalled()
  })
})
