import { describe, it, expect, afterAll } from "vitest"
import { db } from "@/lib/prisma"
import { clockIn } from "@/lib/services/clockService"
import { createShift, updateShift, copyPreviousWeek, duplicateSchedule } from "@/lib/services/scheduleService"
import { makeOrg, makeEmployee, makeSchedule, makeShift, cleanup } from "./fixtures"

/**
 * Two invariants that were "check, then act" with nothing serializing them:
 *
 *   1. one OPEN time entry per employee  — otherwise paid hours are counted twice
 *   2. one live shift per employee per date — otherwise someone is rostered twice
 *
 * Under READ COMMITTED (what Neon gives us) two concurrent callers both run the
 * check before either writes, both see a clean slate, and both write. A
 * double-tap on a phone is enough. `lib/services/locks.ts` closes it with
 * `SELECT … FOR UPDATE` on the row every competing write must go through.
 *
 * Only a real database can show any of this: the unit suite mocks Prisma, so
 * both calls resolve against a stub and the interleaving cannot happen.
 *
 * How much each case below actually proves, measured by removing the locks and
 * re-running rather than assumed:
 *
 *   - the shift cases DO fail without them (3 shifts instead of 1 for
 *     concurrent adds, 2 after concurrent moves) — these are real regression
 *     tests;
 *   - the clock-in and copy-week cases pass either way in this harness. The
 *     Neon driver here does not interleave their transactions no matter how the
 *     calls are dispatched, so they stand as guards against a future rewrite,
 *     not as proof. What backs those two paths is that they take the same lock,
 *     through the same helper, as the shift paths that are proven — plus the
 *     unit assertions in clockService.test.ts that pin the FOR UPDATE being
 *     issued before the read it protects.
 */
afterAll(cleanup)

describe("clock-in", () => {
  it("refuses a second clock-in in sequence", async () => {
    const org = await makeOrg({})
    const emp = await makeEmployee(org.id)

    await expect(clockIn(org.id, emp.id)).resolves.toBeTruthy()
    await expect(clockIn(org.id, emp.id)).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("CONCURRENT clock-ins leave exactly one open entry", async () => {
    const org = await makeOrg({})
    const emp = await makeEmployee(org.id)

    const results = await Promise.allSettled([
      clockIn(org.id, emp.id),
      clockIn(org.id, emp.id),
      clockIn(org.id, emp.id),
    ])
    const ok = results.filter((r) => r.status === "fulfilled").length

    const open = await db.timeEntry.count({
      where: { employeeId: emp.id, clockOut: null },
    })
    expect(open).toBe(1)
    expect(ok).toBe(1)
  })

  it("does not block a different employee clocking in at the same moment", async () => {
    // The lock is per-employee: a shared lock would serialize the whole shift
    // change-over, which for a restaurant is every phone at once.
    const org = await makeOrg({})
    const [a, b] = [await makeEmployee(org.id), await makeEmployee(org.id)]

    const results = await Promise.all([clockIn(org.id, a.id), clockIn(org.id, b.id)])
    expect(results).toHaveLength(2)
    expect(await db.timeEntry.count({ where: { clockOut: null, employeeId: { in: [a.id, b.id] } } })).toBe(2)
  })
})

describe("one live shift per employee per date", () => {
  const WEEK = "2026-09-07"
  const DATE = "2026-09-09"

  async function orgWithSchedule() {
    const org = await makeOrg({})
    const emp = await makeEmployee(org.id)
    const schedule = await makeSchedule(org.id, WEEK)
    return { org, emp, schedule }
  }

  const shiftInput = {
    date: DATE,
    startTime: "09:00",
    endTime: "17:00",
    jobRole: "Kitchen",
  }

  it("refuses a second shift on the same date in sequence", async () => {
    const { org, emp, schedule } = await orgWithSchedule()

    await expect(createShift(org.id, schedule.id, { ...shiftInput, employeeId: emp.id })).resolves.toBeTruthy()
    await expect(
      createShift(org.id, schedule.id, { ...shiftInput, employeeId: emp.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("CONCURRENT adds create exactly one shift", async () => {
    const { org, emp, schedule } = await orgWithSchedule()

    const results = await Promise.allSettled([
      createShift(org.id, schedule.id, { ...shiftInput, employeeId: emp.id }),
      createShift(org.id, schedule.id, { ...shiftInput, employeeId: emp.id }),
      createShift(org.id, schedule.id, { ...shiftInput, employeeId: emp.id }),
    ])
    const ok = results.filter((r) => r.status === "fulfilled").length

    const live = await db.shift.count({
      where: { employeeId: emp.id, date: new Date(DATE + "T00:00:00Z"), cancelledAt: null },
    })
    expect(live).toBe(1)
    expect(ok).toBe(1)
  })

  it("a cancelled shift does not block re-rostering that day", async () => {
    // The rule is about LIVE shifts. Cancelled ones stay as a record and must
    // not lock the day — a partial unique index that forgot this would break
    // the ordinary "cancel it, then put someone else on" flow.
    const { org, emp, schedule } = await orgWithSchedule()
    await makeShift({
      orgId: org.id, scheduleId: schedule.id, employeeId: emp.id, date: DATE,
    })
    await db.shift.updateMany({
      where: { employeeId: emp.id },
      data: { cancelledAt: new Date() },
    })

    await expect(
      createShift(org.id, schedule.id, { ...shiftInput, employeeId: emp.id }),
    ).resolves.toBeTruthy()
  })

  it("CONCURRENT moves onto one person's day leave them with one shift", async () => {
    const { org, emp, schedule } = await orgWithSchedule()
    const other = await makeEmployee(org.id)
    // Two shifts on two other days, both about to be moved onto DATE.
    const first = await makeShift({
      orgId: org.id, scheduleId: schedule.id, employeeId: other.id, date: "2026-09-10",
    })
    const second = await makeShift({
      orgId: org.id, scheduleId: schedule.id, employeeId: other.id, date: "2026-09-11",
    })

    const results = await Promise.allSettled([
      updateShift(org.id, schedule.id, first.id, { employeeId: emp.id, date: DATE }),
      updateShift(org.id, schedule.id, second.id, { employeeId: emp.id, date: DATE }),
    ])
    const ok = results.filter((r) => r.status === "fulfilled").length

    const live = await db.shift.count({
      where: { employeeId: emp.id, date: new Date(DATE + "T00:00:00Z"), cancelledAt: null },
    })
    expect(live).toBe(1)
    expect(ok).toBe(1)
  })
})

describe("bulk rota writes", () => {
  it("CONCURRENT copy-previous-week does not double the rota", async () => {
    // The double-click case. Both calls used to find the target week empty and
    // both copied into it, so every employee ended the day with two of every
    // shift — and the manager had no idea until someone turned up twice.
    const org = await makeOrg({})
    const emp = await makeEmployee(org.id)
    const source = await makeSchedule(org.id, "2026-10-05")
    await makeShift({ orgId: org.id, scheduleId: source.id, employeeId: emp.id, date: "2026-10-07" })

    const results = await Promise.allSettled([
      copyPreviousWeek(org.id, "2026-10-12"),
      copyPreviousWeek(org.id, "2026-10-12"),
    ])
    const ok = results.filter((r) => r.status === "fulfilled").length

    const copied = await db.shift.count({
      where: { organizationId: org.id, date: new Date("2026-10-14T00:00:00Z") },
    })
    expect(copied).toBe(1)
    expect(ok).toBe(1)
  })

  it("duplicating onto a week that already has shifts is refused, not merged", async () => {
    // This used to create a SECOND schedule row for the target week and copy the
    // shifts in regardless — double-booking everyone already rostered there, and
    // leaving the week with two schedules.
    const org = await makeOrg({})
    const emp = await makeEmployee(org.id)
    const source = await makeSchedule(org.id, "2026-11-02")
    await makeShift({ orgId: org.id, scheduleId: source.id, employeeId: emp.id, date: "2026-11-04" })

    const target = await makeSchedule(org.id, "2026-11-09")
    await makeShift({ orgId: org.id, scheduleId: target.id, employeeId: emp.id, date: "2026-11-11" })

    await expect(duplicateSchedule(org.id, source.id, "2026-11-09")).rejects.toMatchObject({
      code: "CONFLICT",
    })

    // One schedule for that week, and the shift that was already there is intact.
    expect(await db.schedule.count({
      where: { organizationId: org.id, weekStart: new Date("2026-11-09T00:00:00Z") },
    })).toBe(1)
    expect(await db.shift.count({ where: { scheduleId: target.id } })).toBe(1)
  })
})
