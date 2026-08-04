import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import {
  createShiftOffer,
  respondToOffer,
  confirmOffer,
  cancelOffer,
} from "@/lib/services/shiftOfferService"
import { sendShiftOfferResultEmail } from "@/lib/resend"
import { sendShiftOfferResultSms } from "@/lib/sms"
import { sendPushToUsers } from "@/lib/push"

vi.mock("@/lib/prisma", () => ({
  db: {
    shiftOffer: {
      findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(),
      // cancelOffer resolves via compare-and-swap so a concurrent confirm — which
      // creates a real Shift — cannot be overwritten after the fact.
      updateMany: vi.fn(), findUniqueOrThrow: vi.fn(),
    },
    shiftOfferRecipient: { update: vi.fn() },
    employee: { findFirst: vi.fn(), findMany: vi.fn() },
    organization: { findUnique: vi.fn() },
    shift: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

// Notifications must never construct a real Twilio/Resend/web-push client.
vi.mock("@/lib/resend", () => ({
  sendShiftOfferEmail: vi.fn().mockResolvedValue(undefined),
  sendShiftOfferResultEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/sms", () => ({
  sendShiftOfferedSms: vi.fn().mockResolvedValue(undefined),
  sendShiftOfferResultSms: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/push", () => ({ sendPushToUsers: vi.fn().mockResolvedValue(0) }))
vi.mock("@/lib/services/scheduleService", () => ({
  getOrCreateSchedule: vi.fn().mockResolvedValue({ schedule: { id: "sched_1" }, created: false }),
}))
vi.mock("@/lib/messages", () => ({
  resolveRecipientLocale: () => "en",
  recipientLocaleTag: () => "en-GB",
  getMessageTranslator: () => (k: string) => k,
}))

const soFindFirst = vi.mocked(db.shiftOffer.findFirst)
const soCreate = vi.mocked(db.shiftOffer.create)
const soUpdateMany = vi.mocked(db.shiftOffer.updateMany)
const soFindUniqueOrThrow = vi.mocked(db.shiftOffer.findUniqueOrThrow)
const recUpdate = vi.mocked(db.shiftOfferRecipient.update)
const empFindFirst = vi.mocked(db.employee.findFirst)
const empFindMany = vi.mocked(db.employee.findMany)
const orgFindUnique = vi.mocked(db.organization.findUnique)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const txMock = vi.mocked(db.$transaction as any)
const resultEmail = vi.mocked(sendShiftOfferResultEmail)
const resultSms = vi.mocked(sendShiftOfferResultSms)
const pushToUsers = vi.mocked(sendPushToUsers)

const ORG = "org_1"
const FUTURE = "2999-01-01T00:00:00Z"
const PAST = "2000-01-01T00:00:00Z"

function offerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "off_1",
    organizationId: ORG,
    date: new Date("2026-07-20T00:00:00Z"),
    startTime: "17:00",
    endTime: "23:00",
    jobRole: "Waiter",
    breakMinutes: 30,
    note: null,
    deadline: new Date(FUTURE),
    status: "OPEN",
    filledEmployeeId: null,
    createdAt: new Date("2026-07-15T00:00:00Z"),
    updatedAt: new Date("2026-07-15T00:00:00Z"),
    resolvedAt: null,
    recipients: [
      { id: "rec_A", employeeId: "emp_A", response: "PENDING", respondedAt: null, employee: { name: "Alice" } },
    ],
    ...overrides,
  }
}

const baseInput = {
  date: "2026-07-20",
  startTime: "17:00",
  endTime: "23:00",
  jobRole: "Waiter",
  deadline: FUTURE,
  employeeIds: ["emp_A"],
}

beforeEach(() => {
  vi.clearAllMocks()
  orgFindUnique.mockResolvedValue({ name: "The Cafe", locale: "en" } as never)
  empFindMany.mockResolvedValue([{ id: "emp_A", name: "Alice", email: null, phone: null, smsConsentAt: null, locale: null, userId: null }] as never)
})

describe("createShiftOffer", () => {
  it("rejects an invalid date", async () => {
    await expect(createShiftOffer(ORG, "mgr_1", { ...baseInput, date: "nope" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("rejects identical start/end times", async () => {
    await expect(createShiftOffer(ORG, "mgr_1", { ...baseInput, endTime: "17:00" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("rejects a deadline in the past", async () => {
    await expect(createShiftOffer(ORG, "mgr_1", { ...baseInput, deadline: PAST })).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("rejects when no employees are selected", async () => {
    await expect(createShiftOffer(ORG, "mgr_1", { ...baseInput, employeeIds: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("rejects when a selected employee isn't valid for the org", async () => {
    empFindMany.mockResolvedValueOnce([] as never) // validation query returns none
    await expect(createShiftOffer(ORG, "mgr_1", baseInput)).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("creates an OPEN offer with recipients", async () => {
    empFindMany.mockResolvedValueOnce([{ id: "emp_A" }] as never) // validation
    soCreate.mockResolvedValue(offerRow() as never)

    const result = await createShiftOffer(ORG, "mgr_1", baseInput)
    expect(result.status).toBe("OPEN")
    expect(result.date).toBe("2026-07-20")
    expect(result.recipients).toHaveLength(1)
    expect(result.recipients[0].employeeName).toBe("Alice")
    expect(soCreate).toHaveBeenCalledOnce()
  })
})

describe("respondToOffer", () => {
  it("rejects a non-recipient", async () => {
    empFindFirst.mockResolvedValue({ id: "emp_STRANGER", name: "Zed" } as never)
    soFindFirst.mockResolvedValue(offerRow() as never)
    await expect(respondToOffer(ORG, "user_Z", "off_1", "ACCEPTED")).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("rejects when the offer isn't OPEN", async () => {
    empFindFirst.mockResolvedValue({ id: "emp_A", name: "Alice" } as never)
    soFindFirst.mockResolvedValue(offerRow({ status: "FILLED" }) as never)
    await expect(respondToOffer(ORG, "user_A", "off_1", "ACCEPTED")).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("rejects when the deadline has passed", async () => {
    empFindFirst.mockResolvedValue({ id: "emp_A", name: "Alice" } as never)
    soFindFirst.mockResolvedValue(offerRow({ deadline: new Date(PAST) }) as never)
    await expect(respondToOffer(ORG, "user_A", "off_1", "ACCEPTED")).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("records the recipient's response", async () => {
    empFindFirst.mockResolvedValue({ id: "emp_A", name: "Alice" } as never)
    soFindFirst.mockResolvedValue(offerRow() as never)
    recUpdate.mockResolvedValue({} as never)

    const result = await respondToOffer(ORG, "user_A", "off_1", "ACCEPTED")
    expect(result.myResponse).toBe("ACCEPTED")
    expect(recUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "rec_A" },
      data: expect.objectContaining({ response: "ACCEPTED" }),
    }))
  })
})

describe("confirmOffer", () => {
  it("rejects confirming someone who didn't accept", async () => {
    soFindFirst.mockResolvedValue(offerRow() as never) // recipient is PENDING
    await expect(confirmOffer(ORG, "mgr_1", "off_1", "emp_A")).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("rejects confirming a non-recipient", async () => {
    soFindFirst.mockResolvedValue(offerRow() as never)
    await expect(confirmOffer(ORG, "mgr_1", "off_1", "emp_GHOST")).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("creates the shift and marks the offer FILLED", async () => {
    soFindFirst.mockResolvedValue(offerRow({
      recipients: [{ id: "rec_A", employeeId: "emp_A", response: "ACCEPTED", respondedAt: new Date(), employee: { name: "Alice" } }],
    }) as never)
    const shiftCreate = vi.fn().mockResolvedValue({ id: "shift_new" })
    const offerTxUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
    const offerTxUpdate = vi.fn().mockResolvedValue(offerRow({ status: "FILLED", filledEmployeeId: "emp_A" }))
    txMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        shift: { create: shiftCreate, findFirst: vi.fn().mockResolvedValue(null) },
        shiftOffer: { updateMany: offerTxUpdateMany, update: offerTxUpdate },
      }),
    )

    const result = await confirmOffer(ORG, "mgr_1", "off_1", "emp_A")
    expect(result.status).toBe("FILLED")
    // Claim must be status-guarded so a concurrent confirm can't double-fill.
    expect(offerTxUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "off_1", status: "OPEN" },
    }))
    expect(shiftCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ employeeId: "emp_A", scheduleId: "sched_1", startTime: "17:00" }),
    }))
  })

  it("loses cleanly (no shift) when a concurrent confirm already filled it", async () => {
    soFindFirst.mockResolvedValue(offerRow({
      recipients: [{ id: "rec_A", employeeId: "emp_A", response: "ACCEPTED", respondedAt: new Date(), employee: { name: "Alice" } }],
    }) as never)
    const shiftCreate = vi.fn()
    // Another transaction filled the offer between our read and our claim.
    const offerTxUpdateMany = vi.fn().mockResolvedValue({ count: 0 })
    txMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        shift: { create: shiftCreate, findFirst: vi.fn().mockResolvedValue(null) },
        shiftOffer: { updateMany: offerTxUpdateMany, update: vi.fn() },
      }),
    )

    await expect(confirmOffer(ORG, "mgr_1", "off_1", "emp_A")).rejects.toMatchObject({ code: "CONFLICT" })
    expect(shiftCreate).not.toHaveBeenCalled()
  })

  it("refuses to double-book someone who picked up a shift after accepting", async () => {
    const shiftCreate = vi.fn()
    const offerTxUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
    txMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        // They already have a live shift that date — confirming would silently
        // give them two overlapping shifts, which is what used to happen.
        shift: { create: shiftCreate, findFirst: vi.fn().mockResolvedValue({ id: "shift_existing" }) },
        shiftOffer: { updateMany: offerTxUpdateMany, update: vi.fn() },
      }),
    )

    await expect(confirmOffer(ORG, "mgr_1", "off_1", "emp_A")).rejects.toMatchObject({ code: "CONFLICT" })
    expect(shiftCreate).not.toHaveBeenCalled()
  })
})

describe("cancelOffer", () => {
  // Base offer used across cancellation tests: one recipient who accepted, one
  // who never responded, one who declined. Only the accepter should hear about it.
  function cancelSourceRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "off_1",
      status: "OPEN",
      date: new Date("2026-07-20T00:00:00Z"),
      startTime: "17:00",
      endTime: "23:00",
      jobRole: "Waiter",
      recipients: [
        { employeeId: "emp_A", response: "ACCEPTED" },
        { employeeId: "emp_B", response: "PENDING" },
        { employeeId: "emp_C", response: "DECLINED" },
      ],
      ...overrides,
    }
  }

  it("rejects cancelling an already-resolved offer", async () => {
    soFindFirst.mockResolvedValue({ id: "off_1", status: "FILLED" } as never)
    await expect(cancelOffer(ORG, "off_1")).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("marks an open offer CANCELLED", async () => {
    soFindFirst.mockResolvedValue(cancelSourceRow({ recipients: [] }) as never)
    soUpdateMany.mockResolvedValue({ count: 1 } as never)
    soFindUniqueOrThrow.mockResolvedValue(offerRow({ status: "CANCELLED" }) as never)

    const result = await cancelOffer(ORG, "off_1")
    expect(result.status).toBe("CANCELLED")
    // `status: "OPEN"` in the WHERE is the guard: a confirm that already filled
    // the offer must not be cancellable out from under the shift it created.
    expect(soUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "off_1", status: "OPEN" }),
      data: expect.objectContaining({ status: "CANCELLED" }),
    }))
  })

  it("notifies everyone who ACCEPTED, and nobody who didn't", async () => {
    soFindFirst.mockResolvedValue(cancelSourceRow() as never)
    soUpdateMany.mockResolvedValue({ count: 1 } as never)
    soFindUniqueOrThrow.mockResolvedValue(offerRow({ status: "CANCELLED" }) as never)
    empFindMany.mockResolvedValue([
      { id: "emp_A", name: "Alice", email: "alice@example.com", phone: "+15551234567", smsConsentAt: new Date(), locale: null, userId: "user_A" },
    ] as never)

    await cancelOffer(ORG, "off_1")

    // Only the accepted employee's id was looked up — the pending and declined
    // recipients were never even fetched for notification.
    expect(empFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["emp_A"] } },
    }))
    expect(resultEmail).toHaveBeenCalledTimes(1)
    expect(resultEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "alice@example.com", outcome: "withdrawn" }))
    expect(resultSms).toHaveBeenCalledTimes(1)
    expect(resultSms).toHaveBeenCalledWith(expect.objectContaining({ to: "+15551234567", outcome: "withdrawn" }))
    expect(pushToUsers).toHaveBeenCalledTimes(1)
    expect(pushToUsers).toHaveBeenCalledWith(["user_A"], expect.objectContaining({
      title: "push.shiftOfferWithdrawnTitle",
      body: "push.shiftOfferWithdrawnBody",
    }))
  })

  it("sends nobody a notification when nobody had accepted", async () => {
    soFindFirst.mockResolvedValue(cancelSourceRow({
      recipients: [
        { employeeId: "emp_B", response: "PENDING" },
        { employeeId: "emp_C", response: "DECLINED" },
      ],
    }) as never)
    soUpdateMany.mockResolvedValue({ count: 1 } as never)
    soFindUniqueOrThrow.mockResolvedValue(offerRow({ status: "CANCELLED" }) as never)

    await cancelOffer(ORG, "off_1")

    expect(empFindMany).not.toHaveBeenCalled()
    expect(resultEmail).not.toHaveBeenCalled()
    expect(resultSms).not.toHaveBeenCalled()
    expect(pushToUsers).not.toHaveBeenCalled()
  })

  it("still resolves the cancellation even if the notification fails", async () => {
    soFindFirst.mockResolvedValue(cancelSourceRow() as never)
    soUpdateMany.mockResolvedValue({ count: 1 } as never)
    soFindUniqueOrThrow.mockResolvedValue(offerRow({ status: "CANCELLED" }) as never)
    empFindMany.mockResolvedValue([
      { id: "emp_A", name: "Alice", email: "alice@example.com", phone: null, smsConsentAt: null, locale: null, userId: null },
    ] as never)
    resultEmail.mockRejectedValueOnce(new Error("Resend is down"))

    const result = await cancelOffer(ORG, "off_1")
    expect(result.status).toBe("CANCELLED")
  })
})
