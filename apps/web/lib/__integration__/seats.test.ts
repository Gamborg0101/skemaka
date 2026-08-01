/**
 * The seat guard against a real database.
 *
 * The unit suite asserts the guard's logic with a fake transaction client. It
 * cannot test the thing the guard actually exists for: two concurrent adds both
 * reading `count = seats - 1` and both succeeding. That needs real transactions
 * and a real row lock.
 */
import { describe, it, expect, afterAll } from "vitest"
import { db } from "@/lib/prisma"
import { assertSeatAvailable } from "@/lib/services/seats"
import { ServiceError } from "@/lib/services/errors"
import { makeOrg, makeEmployee, cleanup } from "./fixtures"

afterAll(cleanup)

/** One add, guarded and committed atomically — mirrors createEmployee. */
async function addEmployeeGuarded(orgId: string, name: string) {
  return db.$transaction(async (tx) => {
    await assertSeatAvailable(tx, orgId)
    return tx.employee.create({
      data: {
        organizationId: orgId,
        name,
        email: `${name.toLowerCase().replace(/\W+/g, "-")}-${Date.now().toString(36)}@example.test`,
        jobRole: "Kitchen",
        hourlyWage: 100,
        wageBaseAmount: 100,
        wageBaseCurrency: "EUR",
        isActive: true,
      },
    })
  })
}

describe("assertSeatAvailable against real SQL", () => {
  it("allows an add below the cap and blocks at it", async () => {
    const org = await makeOrg({ seats: 5 })
    for (let i = 0; i < 4; i++) await makeEmployee(org.id)

    await expect(addEmployeeGuarded(org.id, "Fifth")).resolves.toBeTruthy()
    await expect(addEmployeeGuarded(org.id, "Sixth")).rejects.toThrow(ServiceError)

    expect(await db.employee.count({ where: { organizationId: org.id, isActive: true } })).toBe(5)
  })

  it("does not enforce during a trial", async () => {
    const org = await makeOrg({ seats: 5, subscriptionStatus: "TRIALING" })
    for (let i = 0; i < 5; i++) await makeEmployee(org.id)
    await expect(addEmployeeGuarded(org.id, "Trial Extra")).resolves.toBeTruthy()
  })

  it("counts only ACTIVE employees — a deactivated one frees its place", async () => {
    const org = await makeOrg({ seats: 5 })
    const emps = []
    for (let i = 0; i < 5; i++) emps.push(await makeEmployee(org.id))

    await expect(addEmployeeGuarded(org.id, "Blocked")).rejects.toThrow(ServiceError)
    await db.employee.update({ where: { id: emps[0].id }, data: { isActive: false } })
    await expect(addEmployeeGuarded(org.id, "Now Fits")).resolves.toBeTruthy()
  })

  it("honours a reduction whose effective date has passed", async () => {
    // Resolved in SQL by the guard's CASE expression, not by a cron — so a
    // missed job can never leave an org holding places it stopped paying for.
    const org = await makeOrg({ seats: 10 })
    for (let i = 0; i < 6; i++) await makeEmployee(org.id)
    await db.organization.update({
      where: { id: org.id },
      data: { pendingSeats: 6, pendingSeatsEffectiveAt: new Date(Date.now() - 60_000) },
    })
    // Effective count is now 6, and 6 are active → the next add must be blocked.
    await expect(addEmployeeGuarded(org.id, "Over Reduced Cap")).rejects.toThrow(ServiceError)
  })

  it("ignores a reduction that is not due yet", async () => {
    const org = await makeOrg({ seats: 10 })
    for (let i = 0; i < 6; i++) await makeEmployee(org.id)
    await db.organization.update({
      where: { id: org.id },
      data: { pendingSeats: 6, pendingSeatsEffectiveAt: new Date(Date.now() + 3_600_000) },
    })
    // Still paying for 10 until the period rolls over, so still allowed.
    await expect(addEmployeeGuarded(org.id, "Within Paid Cap")).resolves.toBeTruthy()
  })

  it("CONCURRENT adds cannot exceed the cap — the whole reason for the row lock", async () => {
    // This is the case a mocked transaction client can never exercise. Without
    // SELECT … FOR UPDATE both transactions read count = seats - 1, both pass,
    // and the org ends up one place over what it pays for.
    const org = await makeOrg({ seats: 5 })
    for (let i = 0; i < 4; i++) await makeEmployee(org.id)

    const results = await Promise.allSettled([
      addEmployeeGuarded(org.id, "RaceA"),
      addEmployeeGuarded(org.id, "RaceB"),
      addEmployeeGuarded(org.id, "RaceC"),
    ])
    const ok = results.filter((r) => r.status === "fulfilled").length

    expect(ok, "exactly one of the three concurrent adds may take the last place").toBe(1)
    expect(await db.employee.count({ where: { organizationId: org.id, isActive: true } })).toBe(5)
  })
})
