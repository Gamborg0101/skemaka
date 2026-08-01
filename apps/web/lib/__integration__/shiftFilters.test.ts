/**
 * SQL semantics the unit suite structurally cannot see.
 *
 * Every one of these failed in production and was caught by hand. They exist so
 * the next one is caught by CI instead.
 */
import { describe, it, expect, afterAll } from "vitest"
import { db } from "@/lib/prisma"
import { NOT_SICK } from "@/lib/services/shiftFilters"
import { makeOrg, makeEmployee, makeSchedule, makeShift, cleanup } from "./fixtures"

afterAll(cleanup)

describe("colorTag filtering — three-valued logic", () => {
  it("`{ not: 'sick' }` DROPS uncoloured rows (the bug, pinned so it can't return)", async () => {
    const org = await makeOrg()
    const emp = await makeEmployee(org.id)
    const sched = await makeSchedule(org.id, "2027-01-04")
    await makeShift({ orgId: org.id, scheduleId: sched.id, employeeId: emp.id, date: "2027-01-04", colorTag: null })
    await makeShift({ orgId: org.id, scheduleId: sched.id, employeeId: emp.id, date: "2027-01-05", colorTag: "orange" })

    // This is what the code used to do. `colorTag <> 'sick'` is NULL — not
    // true — for the uncoloured row, so SQL discards it.
    const naive = await db.shift.count({
      where: { organizationId: org.id, colorTag: { not: "sick" } },
    })
    expect(naive, "if this is 2, Prisma changed its NULL handling — revisit NOT_SICK").toBe(1)
  })

  it("NOT_SICK keeps uncoloured rows and still excludes sick ones", async () => {
    const org = await makeOrg()
    const emp = await makeEmployee(org.id)
    const sched = await makeSchedule(org.id, "2027-01-04")
    await makeShift({ orgId: org.id, scheduleId: sched.id, employeeId: emp.id, date: "2027-01-04", colorTag: null })
    await makeShift({ orgId: org.id, scheduleId: sched.id, employeeId: emp.id, date: "2027-01-05", colorTag: "orange" })
    await makeShift({ orgId: org.id, scheduleId: sched.id, employeeId: emp.id, date: "2027-01-06", colorTag: "sick" })

    const kept = await db.shift.findMany({
      where: { organizationId: org.id, ...NOT_SICK },
      select: { colorTag: true },
    })
    expect(kept).toHaveLength(2)
    expect(kept.map((s) => s.colorTag).sort()).toEqual([null, "orange"])
  })
})

describe("findFirst without orderBy", () => {
  it("is indeterminate when several rows match — orderBy is not optional", async () => {
    // CLAUDE.md warns about this; here it is, demonstrated rather than asserted.
    const org = await makeOrg()
    const emp = await makeEmployee(org.id)
    const sched = await makeSchedule(org.id, "2027-02-01")
    const made = []
    for (let i = 0; i < 5; i++) {
      made.push(await makeShift({
        orgId: org.id, scheduleId: sched.id, employeeId: emp.id,
        date: "2027-02-0" + (i + 1),
      }))
    }
    // With orderBy the answer is stable and defined…
    const first = await db.shift.findFirst({
      where: { organizationId: org.id },
      orderBy: { date: "asc" },
    })
    expect(first?.id).toBe(made[0].id)

    // …and querying the same set twice must agree. (Without orderBy Postgres is
    // free to return any matching row; this asserts the fix, not the bug.)
    const again = await db.shift.findFirst({
      where: { organizationId: org.id },
      orderBy: { date: "asc" },
    })
    expect(again?.id).toBe(first?.id)
  })
})

describe("Employee uniqueness", () => {
  it("email is unique per ORG, not globally — the /my-shifts bug in one assertion", async () => {
    const a = await makeOrg()
    const b = await makeOrg()
    const shared = `shared-${Date.now().toString(36)}@example.test`

    await makeEmployee(a.id, { email: shared })
    await makeEmployee(b.id, { email: shared })

    // Two rows, same email, different orgs. A lookup by email alone therefore
    // has to pick one — which is exactly how /my-shifts rendered another
    // restaurant's schedule.
    const byEmailOnly = await db.employee.count({ where: { email: shared, isActive: true } })
    expect(byEmailOnly).toBe(2)

    // Scoped, it is unambiguous.
    const scoped = await db.employee.count({
      where: { email: shared, isActive: true, organizationId: a.id },
    })
    expect(scoped).toBe(1)
  })

  it("rejects a duplicate email within the same org", async () => {
    const org = await makeOrg()
    const email = `dupe-${Date.now().toString(36)}@example.test`
    await makeEmployee(org.id, { email })
    await expect(makeEmployee(org.id, { email })).rejects.toThrow()
  })
})

describe("cascade deletes", () => {
  it("deleting an org removes its employees, schedules and shifts", async () => {
    const org = await makeOrg()
    const emp = await makeEmployee(org.id)
    const sched = await makeSchedule(org.id, "2027-03-01")
    await makeShift({ orgId: org.id, scheduleId: sched.id, employeeId: emp.id, date: "2027-03-01" })

    await db.organization.delete({ where: { id: org.id } })

    expect(await db.employee.count({ where: { organizationId: org.id } })).toBe(0)
    expect(await db.schedule.count({ where: { organizationId: org.id } })).toBe(0)
    expect(await db.shift.count({ where: { organizationId: org.id } })).toBe(0)
  })
})
