/**
 * Seat guard.
 *
 * `assertSeatAvailable` is the single choke point protecting the seat cap. It
 * is called from three places that can make an employee active — createEmployee,
 * updateEmployee (isActive false → true) and the manager self-record toggle in
 * orgService — so a bug here is a bug in all three, and a missing call site is a
 * silent revenue leak.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { assertSeatAvailable, minimumSeatsFor, MIN_SEATS } from "@/lib/services/seats"
import { ServiceError } from "@/lib/services/errors"

const ORG = "org_1"

/** Stands in for a Prisma transaction client. */
function tx(opts: {
  seats?: number
  status?: string
  activeEmployees?: number
  orgMissing?: boolean
}) {
  const queryRaw = vi.fn().mockResolvedValue(
    opts.orgMissing
      ? []
      : [{ seats: opts.seats ?? MIN_SEATS, subscriptionStatus: opts.status ?? "ACTIVE" }],
  )
  const count = vi.fn().mockResolvedValue(opts.activeEmployees ?? 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: { $queryRaw: queryRaw, employee: { count } } as any, queryRaw, count }
}

describe("assertSeatAvailable", () => {
  beforeEach(() => vi.clearAllMocks())

  it("allows an add when a seat is free", async () => {
    const { client } = tx({ seats: 5, activeEmployees: 4 })
    await expect(assertSeatAvailable(client, ORG)).resolves.toBeUndefined()
  })

  it("blocks when every seat is occupied", async () => {
    const { client } = tx({ seats: 5, activeEmployees: 5 })
    await expect(assertSeatAvailable(client, ORG)).rejects.toThrow(ServiceError)
  })

  it("uses the SEAT_LIMIT code so the API answers 402, not 403", async () => {
    const { client } = tx({ seats: 5, activeEmployees: 5 })
    await assertSeatAvailable(client, ORG).catch((err: ServiceError) => {
      expect(err.code).toBe("SEAT_LIMIT")
      // The message is customer-facing — it must say what to do about it.
      expect(err.message).toContain("5 employees")
      expect(err.message.toLowerCase()).toContain("increase your plan")
    })
    expect.assertions(3)
  })

  it("blocks when somehow already over the limit", async () => {
    const { client } = tx({ seats: 5, activeEmployees: 9 })
    await expect(assertSeatAvailable(client, ORG)).rejects.toThrow(ServiceError)
  })

  it("scales with the purchased seat count", async () => {
    const under = tx({ seats: 12, activeEmployees: 11 })
    await expect(assertSeatAvailable(under.client, ORG)).resolves.toBeUndefined()

    const at = tx({ seats: 12, activeEmployees: 12 })
    await expect(assertSeatAvailable(at.client, ORG)).rejects.toThrow(ServiceError)
  })

  it("does not enforce during a trial, however many employees exist", async () => {
    // Trials are unmetered on purpose: a restaurant must be able to load its
    // real team to evaluate the product, then buy seats for it at checkout.
    const { client, count } = tx({ seats: 5, activeEmployees: 40, status: "TRIALING" })
    await expect(assertSeatAvailable(client, ORG)).resolves.toBeUndefined()
    // It should short-circuit before spending a query on the count.
    expect(count).not.toHaveBeenCalled()
  })

  it("DOES enforce while PAST_DUE — a late payer must not add unpaid seats", async () => {
    const { client } = tx({ seats: 5, activeEmployees: 5, status: "PAST_DUE" })
    await expect(assertSeatAvailable(client, ORG)).rejects.toThrow(ServiceError)
  })

  it("enforces for a cancelled subscription", async () => {
    const { client } = tx({ seats: 5, activeEmployees: 5, status: "CANCELED" })
    await expect(assertSeatAvailable(client, ORG)).rejects.toThrow(ServiceError)
  })

  it("takes a row lock — the check-then-act race depends on it", async () => {
    // Without FOR UPDATE two concurrent adds both read seats-1 and both pass.
    const { client, queryRaw } = tx({ seats: 5, activeEmployees: 1 })
    await assertSeatAvailable(client, ORG)
    const sql = queryRaw.mock.calls[0][0].join("?")
    expect(sql).toMatch(/FOR UPDATE/i)
    expect(sql).toMatch(/"Organization"/)
  })

  it("counts only ACTIVE employees — deactivated staff free their seat", async () => {
    const { client, count } = tx({ seats: 5, activeEmployees: 3 })
    await assertSeatAvailable(client, ORG)
    expect(count).toHaveBeenCalledWith({
      where: { organizationId: ORG, isActive: true },
    })
  })

  it("throws NOT_FOUND for a missing organization", async () => {
    const { client } = tx({ orgMissing: true })
    await assertSeatAvailable(client, ORG).catch((err: ServiceError) => {
      expect(err.code).toBe("NOT_FOUND")
    })
    expect.assertions(1)
  })
})

describe("every activation path reserves a seat", () => {
  // The unit tests above prove the guard works. They say nothing about whether
  // it is CALLED. A path that forgets it is invisible until an org quietly ends
  // up over the seats it pays for, so assert the wiring structurally.
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8")

  it("createEmployee reserves a seat inside the insert's transaction", () => {
    const src = read("lib/services/employeeService.ts")
    const fn = src.slice(
      src.indexOf("export async function createEmployee"),
      src.indexOf("export type UpdateEmployeeInput"),
    )
    // Match the CALL, not the identifier — a comment mentioning the helper
    // would otherwise satisfy this even with the call deleted.
    expect(fn).toContain("assertSeatAvailable(tx, orgId)")
    // Same transaction as the insert, or the lock is released too early.
    expect(fn).toContain("$transaction")
    expect(fn.indexOf("assertSeatAvailable(tx, orgId)")).toBeLessThan(fn.indexOf("tx.employee.create"))
  })

  it("updateEmployee reserves a seat when reactivating", () => {
    const src = read("lib/services/employeeService.ts")
    const fn = src.slice(
      src.indexOf("export async function updateEmployee"),
      src.indexOf("export async function deleteEmployee"),
    )
    expect(fn).toContain("assertSeatAvailable(tx, orgId)")
    // Guarded on the false → true transition only: edits to an already-active
    // employee, and deactivations, must never be blocked by a full org.
    expect(fn).toMatch(/input\.isActive === true && !existing\.isActive/)
  })

  it("the manager self-record toggle reserves a seat on all three of its paths", () => {
    const src = read("lib/services/orgService.ts")
    const fn = src.slice(
      src.indexOf("export async function syncManagerEmployee"),
      src.indexOf("// ── Org context for the current user"),
    )
    // reactivate existing · link-and-activate by email · create fresh
    const calls = fn.match(/assertSeatAvailable\(tx, orgId\)/g) ?? []
    expect(calls.length).toBe(3)
  })

  it("no employee is created or reactivated outside a transaction in these files", () => {
    for (const p of ["lib/services/employeeService.ts", "lib/services/orgService.ts"]) {
      const src = read(p)
      // `db.employee.create` / `db.employee.update` bypass the lock entirely.
      // Writes must go through the transaction client (`tx.`) instead.
      expect(src, `${p} writes an employee outside a transaction`).not.toMatch(
        /db\.employee\.(create|createMany)\(/,
      )
    }
  })
})

describe("minimumSeatsFor", () => {
  it("never goes below the seats the base fee includes", () => {
    expect(minimumSeatsFor(0)).toBe(MIN_SEATS)
    expect(minimumSeatsFor(3)).toBe(MIN_SEATS)
    expect(minimumSeatsFor(MIN_SEATS)).toBe(MIN_SEATS)
  })

  it("never strands an active employee without a seat", () => {
    expect(minimumSeatsFor(9)).toBe(9)
    expect(minimumSeatsFor(40)).toBe(40)
  })

  it("matches the pricing module's included-seat count", async () => {
    // If these drift, the €19 base would cover a different number of seats than
    // the guard allows an org to hold.
    const { SEATS_INCLUDED } = await import("@/lib/pricing")
    expect(MIN_SEATS).toBe(SEATS_INCLUDED)
  })
})
