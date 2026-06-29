/**
 * Unit tests for claimInvite in lib/services/employeeService.ts.
 *
 * Covers:
 *  - happy path: links user and creates EMPLOYEE membership
 *  - expired / not-found token → 404-equivalent ServiceError
 *  - already-claimed-by-other-user → CONFLICT ServiceError
 *  - idempotent re-claim (same user) → success, no extra DB work
 *  - manager membership is NOT downgraded to EMPLOYEE
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { claimInvite } from "@/lib/services/employeeService"
import { ServiceError } from "@/lib/services/errors"

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockEmployeeFindFirst = vi.fn()
const mockEmployeeUpdate    = vi.fn()
const mockMembershipUpsert  = vi.fn()
const mockTransaction       = vi.fn()

vi.mock("@/lib/prisma", () => ({
  db: {
    employee: {
      findFirst: (...args: unknown[]) => mockEmployeeFindFirst(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_EXPIRY = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

function makeEmployee(overrides: Partial<{
  userId: string | null
  inviteExpiry: Date
}> = {}) {
  return {
    id:             "emp-1",
    organizationId: "org-1",
    userId:         overrides.userId ?? null,
    name:           "Alice",
    inviteToken:    "tok-abc",
    isActive:       true,
    inviteExpiry:   overrides.inviteExpiry ?? VALID_EXPIRY,
    hourlyWage:     { toNumber: () => 15 },
    wageBaseAmount: null,
    wageBaseCurrency: null,
    createdAt:      new Date(),
    updatedAt:      new Date(),
    email:          "alice@example.com",
    phone:          null,
    jobRole:        "Waiter",
    notes:          null,
    contractedHours: 0,
    employmentType: "PART_TIME",
    organization:   { name: "Test Café" },
  }
}

// Simulate the transaction calling the callback with a tx-client that has
// employee.update and membership.upsert
function setupTransaction() {
  mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
    const txClient = {
      employee:   { update: mockEmployeeUpdate },
      membership: { upsert: mockMembershipUpsert },
    }
    await callback(txClient)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupTransaction()
  mockEmployeeUpdate.mockResolvedValue({})
  mockMembershipUpsert.mockResolvedValue({})
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("claimInvite", () => {
  it("happy path: links user and creates EMPLOYEE membership", async () => {
    mockEmployeeFindFirst.mockResolvedValue(makeEmployee())

    const result = await claimInvite("tok-abc", "user-1")

    expect(result).toEqual({
      organizationId: "org-1",
      employeeId:     "emp-1",
      employeeName:   "Alice",
      orgName:        "Test Café",
    })

    expect(mockTransaction).toHaveBeenCalledOnce()
    expect(mockEmployeeUpdate).toHaveBeenCalledWith({
      where: { id: "emp-1" },
      data:  { userId: "user-1" },
    })
    expect(mockMembershipUpsert).toHaveBeenCalledWith({
      where:  { userId_organizationId: { userId: "user-1", organizationId: "org-1" } },
      create: { userId: "user-1", organizationId: "org-1", role: "EMPLOYEE" },
      update: {},
    })
  })

  it("returns NOT_FOUND for an expired token", async () => {
    mockEmployeeFindFirst.mockResolvedValue(null)

    await expect(claimInvite("tok-expired", "user-1")).rejects.toSatisfy(
      (e: ServiceError) => e instanceof ServiceError && e.code === "NOT_FOUND",
    )
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("returns NOT_FOUND when employee does not exist", async () => {
    mockEmployeeFindFirst.mockResolvedValue(null)

    await expect(claimInvite("tok-missing", "user-1")).rejects.toSatisfy(
      (e: ServiceError) => e instanceof ServiceError && e.code === "NOT_FOUND",
    )
  })

  it("returns CONFLICT when the token was already claimed by a different user", async () => {
    mockEmployeeFindFirst.mockResolvedValue(makeEmployee({ userId: "other-user" }))

    await expect(claimInvite("tok-abc", "user-1")).rejects.toSatisfy(
      (e: ServiceError) =>
        e instanceof ServiceError &&
        e.code === "CONFLICT" &&
        e.message === "This invite has already been claimed",
    )
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("idempotent: returns success when the token is already claimed by this user", async () => {
    mockEmployeeFindFirst.mockResolvedValue(makeEmployee({ userId: "user-1" }))

    const result = await claimInvite("tok-abc", "user-1")

    expect(result.employeeId).toBe("emp-1")
    // No transaction needed — already linked
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("does not downgrade an existing MANAGER membership (update is a no-op)", async () => {
    mockEmployeeFindFirst.mockResolvedValue(makeEmployee())

    await claimInvite("tok-abc", "user-1")

    // The upsert update branch must be an empty object so Prisma preserves
    // whatever role already exists on the membership row.
    expect(mockMembershipUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    )
  })
})
