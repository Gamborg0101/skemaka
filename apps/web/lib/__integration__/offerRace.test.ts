import { describe, it, expect, afterAll } from "vitest"
import { db } from "@/lib/prisma"
import { confirmOffer, cancelOffer } from "@/lib/services/shiftOfferService"
import { makeOrg, makeEmployee, cleanup } from "./fixtures"

/**
 * Confirming an offer creates a real Shift. Cancelling must not be able to undo
 * the record of that while leaving the shift behind.
 *
 * ⚠️ WHAT THESE TESTS DO AND DO NOT PROVE.
 *
 * They assert the invariant — the offer's status and the roster agree — and they
 * pass against BOTH the guarded and unguarded versions of `cancelOffer`. I
 * checked, by reverting the fix and re-running.
 *
 * The reason is that `cancelOffer` reads the status before it writes. Once an
 * offer is FILLED, the pre-flight read rejects the cancel on its own, so the
 * sequential case cannot distinguish a real guard from a courtesy check. And the
 * concurrent case only reaches the dangerous ordering — cancel reads OPEN,
 * confirm wins its swap, cancel then overwrites FILLED — inside a window too
 * narrow to hit reliably from here.
 *
 * The compare-and-swap itself is pinned by lib/__tests__/shiftOfferService.test.ts,
 * which asserts `status: "OPEN"` appears in the updateMany WHERE and fails when
 * it is removed. That is the guard. These tests are the invariant, and would
 * catch a future change that breaks record/roster agreement some other way.
 *
 * Keeping both is deliberate; assuming this file guards the race is not safe.
 */
afterAll(cleanup)

async function openOffer() {
  const org = await makeOrg({})
  const employee = await makeEmployee(org.id, { name: "Taker" })
  const manager = await db.user.create({
    data: { email: `mgr-${Date.now().toString(36)}-${Math.random()}@example.test`, name: "Manager" },
  })
  const offer = await db.shiftOffer.create({
    data: {
      organizationId: org.id,
      date: new Date("2026-08-12T00:00:00Z"),
      startTime: "09:00",
      endTime: "17:00",
      jobRole: "Kitchen",
      breakMinutes: 0,
      deadline: new Date(Date.now() + 86_400_000),
      status: "OPEN",
      createdByUserId: manager.id,
    },
  })
  // confirmOffer only fills for someone who was offered the shift AND accepted.
  await db.shiftOfferRecipient.create({
    data: {
      offerId: offer.id,
      employeeId: employee.id,
      response: "ACCEPTED",
      respondedAt: new Date(),
    },
  })
  return { org, employee, manager, offer }
}

describe("shift offers", () => {
  it("an offer already filled cannot then be cancelled", async () => {
    const { org, employee, manager, offer } = await openOffer()

    await confirmOffer(org.id, manager.id, offer.id, employee.id)
    await expect(cancelOffer(org.id, offer.id)).rejects.toThrow(/already resolved/i)

    const after = await db.shiftOffer.findUniqueOrThrow({ where: { id: offer.id } })
    expect(after.status).toBe("FILLED")
  })

  it("CONCURRENT confirm and cancel cannot leave a shift behind a cancelled offer", async () => {
    const { org, employee, manager, offer } = await openOffer()

    await Promise.allSettled([
      confirmOffer(org.id, manager.id, offer.id, employee.id),
      cancelOffer(org.id, offer.id),
    ])

    const after = await db.shiftOffer.findUniqueOrThrow({ where: { id: offer.id } })
    const shifts = await db.shift.count({
      where: { organizationId: org.id, employeeId: employee.id, date: new Date("2026-08-12T00:00:00Z") },
    })

    // The record and the roster must agree, whichever call won.
    if (after.status === "FILLED") {
      expect(shifts, "a filled offer must have created exactly one shift").toBe(1)
    } else {
      expect(after.status).toBe("CANCELLED")
      expect(shifts, "a cancelled offer must not leave a scheduled shift behind").toBe(0)
    }
  })
})
