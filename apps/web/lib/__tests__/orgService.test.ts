/**
 * One org per manager. Nothing used to stop POST /api/orgs being called twice
 * for the same user — combined with the (now-fixed) missing retry on the
 * onboarding "already have an org?" check, a returning manager could silently
 * create a second, orphaned org. createOrg must hand back the user's existing
 * MANAGER-role org instead of creating a duplicate, while leaving the
 * genuinely-new-user path and the "employee of a second org" path untouched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import { createOrg } from "@/lib/services/orgService"

vi.mock("@/lib/seedDefaultRoles", () => ({
  seedDefaultRoles: vi.fn().mockResolvedValue(undefined),
  seedDefaultShiftTemplates: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/audit", () => ({
  recordAudit: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  db: {
    membership: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

const membershipFindFirst = vi.mocked(db.membership.findFirst)
const orgFindUnique = vi.mocked(db.organization.findUnique)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const txMock = vi.mocked(db.$transaction as any)

const USER = "user_1"

function orgRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "org_1",
    name: "The Small Cafe",
    slug: "the-small-cafe",
    currency: "EUR",
    country: null,
    locale: null,
    timezone: null,
    industry: null,
    settings: null,
    subscriptionStatus: "TRIALING",
    isDemo: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  }
}

/** Wires $transaction to hand the callback a tx client backed by fresh mocks. */
function wireTransaction(newOrg: ReturnType<typeof orgRow>) {
  const createMock = vi.fn().mockResolvedValue(newOrg)
  const upsertMock = vi.fn().mockResolvedValue({ id: USER })
  const membershipCreateMock = vi.fn().mockResolvedValue({})
  txMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      organization: { create: createMock },
      user: { upsert: upsertMock },
      membership: { create: membershipCreateMock },
    }),
  )
  return { createMock, upsertMock, membershipCreateMock }
}

beforeEach(() => {
  vi.clearAllMocks()
  orgFindUnique.mockResolvedValue(null) // slug is free
})

describe("createOrg — one org per manager", () => {
  it("creates a new org when the user has no MANAGER membership", async () => {
    membershipFindFirst.mockResolvedValue(null)
    const created = orgRow()
    const { createMock, membershipCreateMock } = wireTransaction(created)

    const result = await createOrg(USER, { name: "The Small Cafe", currency: "EUR" })

    expect(createMock).toHaveBeenCalledTimes(1)
    expect(membershipCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: USER, role: "MANAGER" }) }),
    )
    expect(result.id).toBe("org_1")
    expect(result.name).toBe("The Small Cafe")
  })

  it("hands back the existing org instead of creating a duplicate when the user already manages one", async () => {
    const existingOrg = orgRow({ id: "org_existing", name: "Original Bistro" })
    membershipFindFirst.mockResolvedValue({
      id: "mem_1",
      userId: USER,
      organizationId: existingOrg.id,
      role: "MANAGER",
      joinedAt: new Date("2025-01-01T00:00:00Z"),
      organization: existingOrg,
    } as never)
    const { createMock, membershipCreateMock } = wireTransaction(orgRow({ id: "org_should_not_exist" }))

    const result = await createOrg(USER, { name: "Second Restaurant", currency: "USD" })

    // No duplicate org, membership, or slug work was ever attempted.
    expect(createMock).not.toHaveBeenCalled()
    expect(membershipCreateMock).not.toHaveBeenCalled()
    expect(txMock).not.toHaveBeenCalled()
    expect(orgFindUnique).not.toHaveBeenCalled()

    // The caller gets their real, original org back — not the payload they
    // just submitted (name/currency from the attempted "Second Restaurant"
    // are discarded).
    expect(result.id).toBe("org_existing")
    expect(result.name).toBe("Original Bistro")
    expect(result.currency).toBe("EUR")
  })

  it("only looks at MANAGER memberships — an EMPLOYEE membership in another org must not block org creation", async () => {
    // employeeService.claimInvite legitimately gives one person an EMPLOYEE
    // membership in a second org (e.g. working two jobs). The guard's query
    // filters role: "MANAGER", so findFirst correctly returns null here and
    // creation proceeds.
    membershipFindFirst.mockResolvedValue(null)
    const created = orgRow({ id: "org_new_for_employee" })
    wireTransaction(created)

    const result = await createOrg(USER, { name: "My Own Place", currency: "EUR" })

    expect(membershipFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER, role: "MANAGER" } }),
    )
    expect(result.id).toBe("org_new_for_employee")
  })
})
