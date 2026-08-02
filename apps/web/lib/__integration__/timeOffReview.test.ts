import { describe, it, expect, afterAll, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import { reviewTimeOff } from "@/lib/services/timeOffService"
import { makeOrg, makeEmployee, cleanup } from "./fixtures"

/**
 * A time-off request may be reviewed once.
 *
 * `reviewTimeOff` read `status === "PENDING"` and then wrote — check-then-act.
 * Two managers reviewing the same request at the same moment both passed the
 * check and both wrote, so the stored status was whichever landed last.
 *
 * The database being briefly wrong is the smaller half. The SMS is sent per
 * call, so the employee received "your time off is approved" AND "your time off
 * is denied" for one request, and had no way to tell which one counted. That is
 * a person deciding whether to book a flight.
 *
 * SMS is mocked here — the assertion is on how many notifications the service
 * tried to send, which is the part that reached the employee.
 */
vi.mock("@/lib/sms", () => ({
  sendTimeOffApprovedSms: vi.fn().mockResolvedValue(undefined),
  sendTimeOffDeniedSms: vi.fn().mockResolvedValue(undefined),
}))

const { sendTimeOffApprovedSms, sendTimeOffDeniedSms } = await import("@/lib/sms")

afterAll(cleanup)
beforeEach(() => vi.clearAllMocks())

async function pendingRequest() {
  const org = await makeOrg({})
  const employee = await makeEmployee(org.id, { name: "Requester" })
  // A phone is what makes the notification fire at all.
  await db.employee.update({
    where: { id: employee.id },
    data: { phone: "+4520304050", smsConsentAt: new Date() },
  })
  const request = await db.timeOffRequest.create({
    data: {
      organizationId: org.id,
      employeeId: employee.id,
      startDate: new Date("2026-09-01T00:00:00Z"),
      endDate: new Date("2026-09-05T00:00:00Z"),
      status: "PENDING",
    },
  })
  return { org, employee, request }
}

describe("time-off review", () => {
  it("a second review is refused rather than overwriting the first", async () => {
    const { org, request } = await pendingRequest()

    await expect(reviewTimeOff(org.id, request.id, "APPROVED")).resolves.toBeTruthy()
    await expect(reviewTimeOff(org.id, request.id, "DENIED")).rejects.toThrow(/no longer pending/i)

    const after = await db.timeOffRequest.findUniqueOrThrow({ where: { id: request.id } })
    expect(after.status).toBe("APPROVED")
  })

  it("CONCURRENT approve and deny send the employee exactly one answer", async () => {
    const { org, request } = await pendingRequest()

    const results = await Promise.allSettled([
      reviewTimeOff(org.id, request.id, "APPROVED"),
      reviewTimeOff(org.id, request.id, "DENIED"),
    ])
    const ok = results.filter((r) => r.status === "fulfilled").length

    const after = await db.timeOffRequest.findUniqueOrThrow({ where: { id: request.id } })
    const sent =
      vi.mocked(sendTimeOffApprovedSms).mock.calls.length +
      vi.mocked(sendTimeOffDeniedSms).mock.calls.length

    expect(ok, "only one review may win").toBe(1)
    expect(after.status).not.toBe("PENDING")
    expect(sent, "the employee must not be told both approved and denied").toBe(1)
  })
})
