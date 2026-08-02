import { describe, it, expect, afterAll } from "vitest"
import { db } from "@/lib/prisma"
import {
  createCoverRequest,
  claimCoverRequest,
  approveCoverRequest,
  denyCoverRequest,
} from "@/lib/services/coverService"
import { makeOrg, makeEmployee, makeSchedule, makeShift, cleanup } from "./fixtures"

/**
 * A shift may be up for cover once, not twice.
 *
 * `createCoverRequest` checks for an existing OPEN/CLAIMED request and then
 * creates one. That is check-then-act: two requests that interleave between the
 * read and the write both see nothing and both insert. A double-tap on "I'll
 * cover it" is enough — the same shape as the billing stepper bug where a fast
 * double-click moved the count by one instead of two.
 *
 * The consequence is not cosmetic: two OPEN requests for one shift means two
 * teammates can each claim "the" shift, and the manager gets duplicate approvals
 * for a single slot.
 *
 * Only a real database can show this. The unit suite mocks Prisma, so both calls
 * resolve against a stub and the interleaving never happens.
 */
afterAll(cleanup)

async function shiftUpForCover() {
  const org = await makeOrg({})
  const owner = await makeEmployee(org.id, { name: "Owner" })
  const schedule = await makeSchedule(org.id, "2026-08-03")
  const shift = await makeShift({
    orgId: org.id,
    scheduleId: schedule.id,
    employeeId: owner.id,
    date: "2026-08-05",
  })
  // createCoverRequest resolves the employee from a userId, so the owner needs one.
  const user = await db.user.create({
    data: { email: `owner-${Date.now().toString(36)}@example.test`, name: "Owner" },
  })
  await db.employee.update({ where: { id: owner.id }, data: { userId: user.id } })
  return { org, owner, user, shift }
}

describe("cover requests", () => {
  it("offering the same shift twice in sequence is refused", async () => {
    const { org, user, shift } = await shiftUpForCover()

    await expect(createCoverRequest(org.id, user.id, shift.id, null)).resolves.toBeTruthy()
    await expect(createCoverRequest(org.id, user.id, shift.id, null)).rejects.toThrow(
      /already up for cover/i,
    )
  })

  it("CONCURRENT offers cannot create two active requests for one shift", async () => {
    const { org, user, shift } = await shiftUpForCover()

    const results = await Promise.allSettled([
      createCoverRequest(org.id, user.id, shift.id, null),
      createCoverRequest(org.id, user.id, shift.id, null),
      createCoverRequest(org.id, user.id, shift.id, null),
    ])
    const ok = results.filter((r) => r.status === "fulfilled").length

    const active = await db.shiftCoverRequest.count({
      where: { shiftId: shift.id, status: { in: ["OPEN", "CLAIMED"] } },
    })

    expect(active, "a shift may be up for cover at most once").toBe(1)
    expect(ok, "exactly one of the three concurrent offers may win").toBe(1)
  })

  it("CONCURRENT claims — only one teammate may take the shift", async () => {
    const { org, user, shift } = await shiftUpForCover()
    const req = await createCoverRequest(org.id, user.id, shift.id, null)

    // Three teammates tap "I'll cover it" at once.
    const claimers = await Promise.all(
      [1, 2, 3].map(async (n) => {
        const e = await makeEmployee(org.id, { name: `Claimer ${n}` })
        const u = await db.user.create({
          data: { email: `claimer-${Date.now().toString(36)}-${n}@example.test`, name: `Claimer ${n}` },
        })
        await db.employee.update({ where: { id: e.id }, data: { userId: u.id } })
        return u.id
      }),
    )

    const results = await Promise.allSettled(
      claimers.map((uid) => claimCoverRequest(org.id, uid, req.id)),
    )
    const ok = results.filter((r) => r.status === "fulfilled").length

    expect(ok, "a second claimer must be told the shift is gone, not silently overwrite the first").toBe(1)
  })

  it("approve and deny racing cannot reassign the shift AND record a denial", async () => {
    const { org, owner, user, shift } = await shiftUpForCover()
    const req = await createCoverRequest(org.id, user.id, shift.id, null)

    const claimer = await makeEmployee(org.id, { name: "Claimer" })
    const claimerUser = await db.user.create({
      data: { email: `c-${Date.now().toString(36)}@example.test`, name: "Claimer" },
    })
    await db.employee.update({ where: { id: claimer.id }, data: { userId: claimerUser.id } })
    await claimCoverRequest(org.id, claimerUser.id, req.id)

    const manager = await db.user.create({
      data: { email: `mgr-${Date.now().toString(36)}@example.test`, name: "Manager" },
    })
    await Promise.allSettled([
      approveCoverRequest(org.id, manager.id, req.id),
      denyCoverRequest(org.id, manager.id, req.id),
    ])

    const [after, finalShift] = await Promise.all([
      db.shiftCoverRequest.findUniqueOrThrow({ where: { id: req.id } }),
      db.shift.findUniqueOrThrow({ where: { id: shift.id }, select: { employeeId: true } }),
    ])

    // The record and the roster must agree. A DENIED request with the shift
    // handed to the claimer means it changed hands with nothing to show for it.
    if (after.status === "APPROVED") {
      expect(finalShift.employeeId, "an approved swap must reassign the shift").toBe(claimer.id)
    } else {
      expect(finalShift.employeeId, "a denied swap must leave the shift with its owner").toBe(owner.id)
    }
  })
})
