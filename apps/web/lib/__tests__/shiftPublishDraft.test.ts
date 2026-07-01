/**
 * Drop-to-draft semantics for shift mutations (A-07). Editing, adding, or
 * deleting a shift on an already-published schedule must clear `publishedAt`
 * (returning it to draft so the manager re-publishes) and must NOT fire the
 * per-shift SMS — the re-publish blast covers the notification instead. On a
 * draft schedule the per-shift SMS still fires and nothing is re-published.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import {
  sendShiftUpdatedSms,
  sendShiftCancelledSms,
  sendShiftAssignedSms,
} from "@/lib/sms"
import { createShift, updateShift, deleteShift } from "@/lib/services/scheduleService"

vi.mock("@/lib/prisma", () => ({
  db: {
    shift: {
      findFirst: vi.fn(),
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
  },
}))

vi.mock("@/lib/sms", () => ({
  sendShiftUpdatedSms: vi.fn(),
  sendShiftCancelledSms: vi.fn(),
  sendShiftAssignedSms: vi.fn(),
  sendSchedulePublishedSms: vi.fn(),
}))

// These tests assert on DB writes and SMS side-effects, not the serialized
// response shape, so an identity serializer keeps the fixtures minimal.
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
    employee: { name: "Sarah Chen", phone: "+15551234567" },
    organization: { name: "The Daily Grind" },
    schedule: { publishedAt: null },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("updateShift drop-to-draft", () => {
  it("clears publishedAt and suppresses per-shift SMS when the schedule was published", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(
      shiftRow({ schedule: { publishedAt: new Date("2026-06-15T10:00:00Z") } }) as never,
    )
    vi.mocked(db.shift.update).mockResolvedValue(shiftRow() as never)

    await updateShift(ORG, SCHEDULE, SHIFT, { startTime: "10:00" })

    expect(db.schedule.update).toHaveBeenCalledWith({
      where: { id: SCHEDULE },
      data: { publishedAt: null },
    })
    expect(sendShiftUpdatedSms).not.toHaveBeenCalled()
    expect(sendShiftAssignedSms).not.toHaveBeenCalled()
    expect(sendShiftCancelledSms).not.toHaveBeenCalled()
  })

  it("leaves a draft schedule alone and still sends the per-shift SMS", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(
      shiftRow({ schedule: { publishedAt: null } }) as never,
    )
    vi.mocked(db.shift.update).mockResolvedValue(shiftRow() as never)

    await updateShift(ORG, SCHEDULE, SHIFT, { startTime: "10:00" })

    expect(db.schedule.update).not.toHaveBeenCalled()
    expect(sendShiftUpdatedSms).toHaveBeenCalledTimes(1)
  })
})

describe("deleteShift drop-to-draft", () => {
  it("clears publishedAt and suppresses the cancellation SMS when published", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(
      shiftRow({ schedule: { publishedAt: new Date("2026-06-15T10:00:00Z") } }) as never,
    )
    vi.mocked(db.shift.delete).mockResolvedValue(shiftRow() as never)

    await deleteShift(ORG, SCHEDULE, SHIFT)

    expect(db.schedule.update).toHaveBeenCalledWith({
      where: { id: SCHEDULE },
      data: { publishedAt: null },
    })
    expect(sendShiftCancelledSms).not.toHaveBeenCalled()
  })

  it("leaves a draft schedule alone and still sends the cancellation SMS", async () => {
    vi.mocked(db.shift.findFirst).mockResolvedValue(
      shiftRow({ schedule: { publishedAt: null } }) as never,
    )
    vi.mocked(db.shift.delete).mockResolvedValue(shiftRow() as never)

    await deleteShift(ORG, SCHEDULE, SHIFT)

    expect(db.schedule.update).not.toHaveBeenCalled()
    expect(sendShiftCancelledSms).toHaveBeenCalledTimes(1)
  })
})

describe("createShift drop-to-draft", () => {
  it("returns a published schedule to draft via the conditional updateMany", async () => {
    vi.mocked(db.employee.findFirst).mockResolvedValue({ id: "emp_1" } as never)
    vi.mocked(db.shift.findFirst).mockResolvedValue(null as never)
    // createShift reads the schedule's publishedAt (for the late-add email path);
    // an employee with no email keeps this test focused on the updateMany reset.
    vi.mocked(db.schedule.findFirst).mockResolvedValue({ publishedAt: new Date("2026-06-15T10:00:00Z") } as never)
    vi.mocked(db.shift.create).mockResolvedValue(shiftRow() as never)

    await createShift(ORG, SCHEDULE, {
      employeeId: "emp_1",
      date: "2026-06-20",
      startTime: "09:00",
      endTime: "17:00",
      jobRole: "Barista",
    })

    expect(db.schedule.updateMany).toHaveBeenCalledWith({
      where: { id: SCHEDULE, organizationId: ORG, publishedAt: { not: null } },
      data: { publishedAt: null },
    })
  })
})
