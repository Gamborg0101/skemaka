/**
 * Clock-in guards.
 *
 * One person can be clocked in once. The check for an existing open entry is
 * only sound if this employee's row is locked FIRST — otherwise two clock-ins
 * arriving together (a double-tap, or the app and the browser at once) both read
 * "nothing open" and both insert, and the hours get paid twice.
 *
 * The integration suite cannot demonstrate that interleaving: the Neon driver
 * refuses to interleave these two transactions no matter how the calls are
 * dispatched (see lib/__integration__/clockAndShiftRace.test.ts). So the lock is
 * pinned here instead, deterministically — that the FOR UPDATE is issued, and
 * that it precedes the read it exists to protect.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import { clockIn } from "@/lib/services/clockService"

/** Every db call this service makes, in order, so ordering can be asserted. */
const calls: string[] = []

vi.mock("@/lib/prisma", () => {
  const record = (name: string, result: unknown) => {
    calls.push(name)
    return Promise.resolve(result)
  }
  const client = {
    employee: { findFirst: vi.fn(() => record("employee.findFirst", { id: "emp_1" })) },
    timeEntry: {
      findFirst: vi.fn(() => record("timeEntry.findFirst", null)),
      create: vi.fn(() => record("timeEntry.create", entryRow())),
    },
    shift: { findFirst: vi.fn(() => record("shift.findFirst", { id: "shift_1" })) },
    // The lock. Recorded under the statement it issues so the assertions read
    // like the SQL does.
    $queryRaw: vi.fn(() => record("SELECT … FOR UPDATE", [{ id: "emp_1" }])),
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(client)),
  }
  return { db: client }
})

function entryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "te_1",
    organizationId: "org_1",
    employeeId: "emp_1",
    shiftId: null,
    clockIn: new Date("2026-08-12T09:00:00.000Z"),
    clockOut: null,
    breakMinutes: 0,
    note: null,
    createdAt: new Date("2026-08-12T09:00:00.000Z"),
    updatedAt: new Date("2026-08-12T09:00:00.000Z"),
    employee: { id: "emp_1", name: "Ida", jobRole: "Bar" },
    ...overrides,
  }
}

const ORG = "org_1"
const EMP = "emp_1"

beforeEach(() => {
  calls.length = 0
  vi.clearAllMocks()
})

describe("clockIn", () => {
  it("locks the employee row before looking for an open entry", async () => {
    await clockIn(ORG, EMP)

    const lockAt = calls.indexOf("SELECT … FOR UPDATE")
    const readAt = calls.indexOf("timeEntry.findFirst")
    const writeAt = calls.indexOf("timeEntry.create")

    expect(lockAt).toBeGreaterThanOrEqual(0)
    expect(lockAt).toBeLessThan(readAt)
    // …and the write happens after the check, inside the same transaction.
    expect(readAt).toBeLessThan(writeAt)
    expect(vi.mocked(db.$transaction)).toHaveBeenCalledTimes(1)
  })

  it("locks the employee named in the request, in this org", async () => {
    await clockIn(ORG, EMP)
    // Tagged-template call: [strings, ...values] — the values are the bindings,
    // which must be the employee and org, never interpolated into the SQL.
    const [, ...bindings] = vi.mocked(db.$queryRaw).mock.calls[0] as unknown[]
    expect(bindings).toEqual([EMP, ORG])
  })

  it("refuses a second clock-in with CONFLICT", async () => {
    vi.mocked(db.timeEntry.findFirst).mockImplementationOnce(
      () => Promise.resolve(entryRow()) as never,
    )
    await expect(clockIn(ORG, EMP)).rejects.toMatchObject({ code: "CONFLICT" })
    expect(db.timeEntry.create).not.toHaveBeenCalled()
  })

  it("rejects an unknown or inactive employee before locking anything", async () => {
    vi.mocked(db.employee.findFirst).mockImplementationOnce(() => Promise.resolve(null) as never)
    await expect(clockIn(ORG, EMP)).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(calls).not.toContain("SELECT … FOR UPDATE")
  })

  it("stamps clockIn from the server clock, never from the caller", async () => {
    await clockIn(ORG, EMP)
    const [arg] = vi.mocked(db.timeEntry.create).mock.calls[0] as [{ data: { clockIn: Date } }]
    expect(arg.data.clockIn).toBeInstanceOf(Date)
    expect(Math.abs(arg.data.clockIn.getTime() - Date.now())).toBeLessThan(5_000)
  })

  it("refuses a shiftId that is not this employee's shift", async () => {
    vi.mocked(db.shift.findFirst).mockImplementationOnce(() => Promise.resolve(null) as never)
    await expect(clockIn(ORG, EMP, "shift_other")).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(db.timeEntry.create).not.toHaveBeenCalled()
  })
})
