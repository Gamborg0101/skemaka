/**
 * Deactivating an employee can optionally sweep their future shifts. This
 * must be atomic with the deactivation itself — a partial result (deactivated
 * but shifts left dangling, or shifts wiped but the employee still active) is
 * worse than either outcome alone — and must never touch shifts that have
 * already happened (those are wage/labour-cost history).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import { updateEmployee } from "@/lib/services/employeeService"

vi.mock("@/lib/prisma", () => ({
  db: {
    employee: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
    shift: { deleteMany: vi.fn() },
    schedulingEvent: { create: vi.fn().mockReturnValue({ catch: vi.fn() }) },
    $transaction: vi.fn(),
  },
}))

const empFindFirst = vi.mocked(db.employee.findFirst)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const txMock = vi.mocked(db.$transaction as any)

const ORG = "org_1"
const EMP = "emp_1"

const existingEmployee = {
  id: EMP,
  isActive: true,
  userId: null,
  hourlyWage: { toNumber: () => 150 },
}

function employeeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EMP,
    organizationId: ORG,
    userId: null,
    name: "Anna Jensen",
    email: "anna@example.com",
    phone: null,
    phoneVerifiedAt: null,
    jobRole: "Barista",
    hourlyWage: { toNumber: () => 150 },
    employmentType: "PART_TIME",
    contractedHours: 20,
    notes: null,
    isActive: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  empFindFirst.mockResolvedValue(existingEmployee as never)
})

/** Wires $transaction to hand the callback a tx client backed by our mocks. */
function wireTransaction(opts: { updateResult?: unknown; deleteManyCount?: number } = {}) {
  const updateMock = vi.fn().mockResolvedValue(opts.updateResult ?? employeeRow())
  const deleteManyMock = vi.fn().mockResolvedValue({ count: opts.deleteManyCount ?? 0 })
  txMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      employee: { update: updateMock },
      shift: { deleteMany: deleteManyMock },
      $queryRaw: vi.fn(),
    }),
  )
  return { updateMock, deleteManyMock }
}

describe("updateEmployee — deactivation + future-shift cleanup", () => {
  it("deletes the employee's future shifts when deactivating with deleteFutureShifts", async () => {
    const { updateMock, deleteManyMock } = wireTransaction({
      updateResult: employeeRow({ isActive: false }),
      deleteManyCount: 3,
    })

    const result = await updateEmployee(ORG, EMP, { isActive: false, deleteFutureShifts: true }, "actor_1")

    expect(result.isActive).toBe(false)
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: EMP },
      data: expect.objectContaining({ isActive: false }),
    }))
    expect(deleteManyMock).toHaveBeenCalledTimes(1)
    const call = deleteManyMock.mock.calls[0][0]
    expect(call.where).toMatchObject({
      organizationId: ORG,
      employeeId: EMP,
      cancelledAt: null,
    })
    // Only future (today or later) shifts are targeted — never past ones.
    expect(call.where.date).toHaveProperty("gte")
    expect(call.where.date.gte).toBeInstanceOf(Date)
    const todayUTCStart = new Date(new Date().toISOString().split("T")[0] + "T00:00:00Z")
    expect(call.where.date.gte.getTime()).toBe(todayUTCStart.getTime())
  })

  it("never scopes the deletion to past shifts — only a lower (future) bound is applied", async () => {
    const { deleteManyMock } = wireTransaction({ deleteManyCount: 1 })

    await updateEmployee(ORG, EMP, { isActive: false, deleteFutureShifts: true }, "actor_1")

    const where = deleteManyMock.mock.calls[0][0].where
    // No upper bound and no explicit inclusion of past dates — the only date
    // constraint is the future-facing `gte`.
    expect(Object.keys(where.date)).toEqual(["gte"])
  })

  it("deletes nothing when deleteFutureShifts is not set", async () => {
    const { updateMock, deleteManyMock } = wireTransaction({ updateResult: employeeRow({ isActive: false }) })

    const result = await updateEmployee(ORG, EMP, { isActive: false }, "actor_1")

    expect(result.isActive).toBe(false)
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(deleteManyMock).not.toHaveBeenCalled()
  })

  it("deletes nothing when deleteFutureShifts is set but the employee is not being deactivated", async () => {
    const { deleteManyMock } = wireTransaction({ updateResult: employeeRow({ name: "Anna J." }) })

    await updateEmployee(ORG, EMP, { name: "Anna J.", deleteFutureShifts: true }, "actor_1")

    expect(deleteManyMock).not.toHaveBeenCalled()
  })

  it("still applies the deactivation even when the shift cleanup removes nothing", async () => {
    const { updateMock, deleteManyMock } = wireTransaction({
      updateResult: employeeRow({ isActive: false }),
      deleteManyCount: 0,
    })

    const result = await updateEmployee(ORG, EMP, { isActive: false, deleteFutureShifts: true }, "actor_1")

    expect(result.isActive).toBe(false)
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(deleteManyMock).toHaveBeenCalledTimes(1)
  })

  it("runs the deactivation and the shift cleanup inside the same transaction", async () => {
    wireTransaction({ updateResult: employeeRow({ isActive: false }), deleteManyCount: 2 })

    await updateEmployee(ORG, EMP, { isActive: false, deleteFutureShifts: true }, "actor_1")

    // Both operations happen via the single $transaction callback — if either
    // failed, Prisma would roll back the whole thing atomically.
    expect(txMock).toHaveBeenCalledTimes(1)
  })
})
