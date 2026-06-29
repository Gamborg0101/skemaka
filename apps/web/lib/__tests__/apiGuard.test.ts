/**
 * Tenant-isolation tests for requireAuth / requireOrgMember.
 *
 * These guards are the security boundary for every /api/orgs/[orgId]/* route:
 * a regression here means cross-org data access or a paywall bypass.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import { NextRequest } from "next/server"
import { getToken, decode } from "next-auth/jwt"
import { db } from "@/lib/prisma"
import { requireAuth, requireOrgMember, requireManagerRole, type AuthGuard } from "@/lib/apiGuard"

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
  decode: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  db: {
    membership: { findFirst: vi.fn() },
    employee: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
}))

const mockGetToken = vi.mocked(getToken)
const mockDecode = vi.mocked(decode)
const mockMembershipFindFirst = vi.mocked(db.membership.findFirst)
const mockEmployeeFindFirst = vi.mocked(db.employee.findFirst)
const mockOrgFindUnique = vi.mocked(db.organization.findUnique)

function req(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/orgs/org1/employees", { headers })
}

async function status(result: { error: Response } | AuthGuard): Promise<number | null> {
  return "error" in result ? result.error.status : null
}

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret"
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetToken.mockResolvedValue(null)
  mockDecode.mockResolvedValue(null)
})

const DAY = 24 * 60 * 60 * 1000

describe("requireAuth", () => {
  it("returns 401 when there is no session token", async () => {
    expect(await status(await requireAuth(req()))).toBe(401)
  })

  it("returns the guard for a valid cookie session", async () => {
    mockGetToken.mockResolvedValue({ sub: "u1", role: "MANAGER", orgId: "org1" })
    const guard = await requireAuth(req())
    expect(guard).toMatchObject({ userId: "u1", role: "MANAGER", orgId: "org1" })
  })

  it("accepts a Bearer token when no cookie is present", async () => {
    mockDecode.mockResolvedValue({ sub: "u1", role: "EMPLOYEE" })
    const guard = await requireAuth(req({ authorization: "Bearer some-jwt" }))
    expect(mockDecode).toHaveBeenCalledWith(expect.objectContaining({ token: "some-jwt" }))
    expect(guard).toMatchObject({ userId: "u1", role: "EMPLOYEE" })
  })

  it("returns 401 when the Bearer token fails to decode", async () => {
    mockDecode.mockRejectedValue(new Error("bad token"))
    expect(await status(await requireAuth(req({ authorization: "Bearer junk" })))).toBe(401)
  })
})

describe("requireOrgMember — JWT fast path", () => {
  it("rejects access to a different org with 403 and no DB lookup", async () => {
    mockGetToken.mockResolvedValue({
      sub: "u1", role: "MANAGER", orgId: "org-OTHER", subscriptionStatus: "ACTIVE",
    })
    expect(await status(await requireOrgMember("org1", req()))).toBe(403)
    expect(mockMembershipFindFirst).not.toHaveBeenCalled()
    expect(mockEmployeeFindFirst).not.toHaveBeenCalled()
  })

  it("allows a member of the org", async () => {
    mockGetToken.mockResolvedValue({
      sub: "u1", role: "MANAGER", orgId: "org1", subscriptionStatus: "ACTIVE",
    })
    const guard = await requireOrgMember("org1", req())
    expect(guard).toMatchObject({ userId: "u1", role: "MANAGER", orgId: "org1" })
  })

  it("blocks a cancelled subscription with 402 (confirmed against the DB)", async () => {
    mockGetToken.mockResolvedValue({
      sub: "u1", role: "MANAGER", orgId: "org1", subscriptionStatus: "CANCELED",
    })
    mockOrgFindUnique.mockResolvedValue({
      subscriptionStatus: "CANCELED", trialEndsAt: null, pastDueSince: null,
    } as never)
    expect(await status(await requireOrgMember("org1", req()))).toBe(402)
  })

  it("lets a cancelled subscription through with allowSuspended (billing routes)", async () => {
    mockGetToken.mockResolvedValue({
      sub: "u1", role: "MANAGER", orgId: "org1", subscriptionStatus: "CANCELED",
    })
    const guard = await requireOrgMember("org1", req(), { allowSuspended: true })
    expect(guard).toMatchObject({ userId: "u1", orgId: "org1" })
    expect(mockOrgFindUnique).not.toHaveBeenCalled()
  })

  it("blocks an expired trial with 402 TRIAL_EXPIRED", async () => {
    mockGetToken.mockResolvedValue({
      sub: "u1", role: "MANAGER", orgId: "org1",
      subscriptionStatus: "TRIALING", trialEndsAt: Date.now() - DAY,
    })
    mockOrgFindUnique.mockResolvedValue({
      subscriptionStatus: "TRIALING", trialEndsAt: new Date(Date.now() - DAY), pastDueSince: null,
    } as never)
    const res = await requireOrgMember("org1", req())
    expect("error" in res && res.error.status).toBe(402)
    expect("error" in res && (await res.error.json()).code).toBe("TRIAL_EXPIRED")
  })

  it("allows a trial that is still active without a DB hit", async () => {
    mockGetToken.mockResolvedValue({
      sub: "u1", role: "MANAGER", orgId: "org1",
      subscriptionStatus: "TRIALING", trialEndsAt: Date.now() + 5 * DAY,
    })
    const guard = await requireOrgMember("org1", req())
    expect(guard).toMatchObject({ userId: "u1", orgId: "org1" })
    expect(mockOrgFindUnique).not.toHaveBeenCalled()
  })

  it("blocks PAST_DUE past the grace window with 402 PAST_DUE_EXPIRED", async () => {
    const pastDueSince = Date.now() - 20 * DAY
    mockGetToken.mockResolvedValue({
      sub: "u1", role: "MANAGER", orgId: "org1",
      subscriptionStatus: "PAST_DUE", pastDueSince,
    })
    mockOrgFindUnique.mockResolvedValue({
      subscriptionStatus: "PAST_DUE", trialEndsAt: null, pastDueSince: new Date(pastDueSince),
    } as never)
    const res = await requireOrgMember("org1", req())
    expect("error" in res && (await res.error.json()).code).toBe("PAST_DUE_EXPIRED")
  })

  it("allows PAST_DUE inside the grace window", async () => {
    mockGetToken.mockResolvedValue({
      sub: "u1", role: "MANAGER", orgId: "org1",
      subscriptionStatus: "PAST_DUE", pastDueSince: Date.now() - 2 * DAY,
    })
    const guard = await requireOrgMember("org1", req())
    expect(guard).toMatchObject({ userId: "u1", orgId: "org1" })
  })

  it("does NOT block on a stale JWT when the DB shows access restored", async () => {
    // JWT still says CANCELED, but the customer just resubscribed → DB is ACTIVE.
    mockGetToken.mockResolvedValue({
      sub: "u1", role: "MANAGER", orgId: "org1", subscriptionStatus: "CANCELED",
    })
    mockOrgFindUnique.mockResolvedValue({
      subscriptionStatus: "ACTIVE", trialEndsAt: null, pastDueSince: null,
    } as never)
    const guard = await requireOrgMember("org1", req())
    expect(guard).toMatchObject({ userId: "u1", orgId: "org1" })
  })

  it("falls back to the DB for a legacy token with no billing claim", async () => {
    mockGetToken.mockResolvedValue({ sub: "u1", role: "MANAGER", orgId: "org1" })
    mockOrgFindUnique.mockResolvedValue({
      subscriptionStatus: "ACTIVE", trialEndsAt: null, pastDueSince: null,
    } as never)
    const guard = await requireOrgMember("org1", req())
    expect(guard).toMatchObject({ userId: "u1", orgId: "org1" })
    expect(mockOrgFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "org1" } }),
    )
  })
})

describe("requireOrgMember — DB slow path (token without orgId)", () => {
  beforeEach(() => {
    mockGetToken.mockResolvedValue({ sub: "u1" })
  })

  it("grants MANAGER when a manager membership exists", async () => {
    mockMembershipFindFirst.mockResolvedValue({
      organization: { subscriptionStatus: "ACTIVE" },
    } as never)
    const guard = await requireOrgMember("org1", req())
    expect(guard).toMatchObject({ userId: "u1", role: "MANAGER", orgId: "org1" })
  })

  it("falls back to EMPLOYEE via an active employee record", async () => {
    mockMembershipFindFirst.mockResolvedValue(null)
    mockEmployeeFindFirst.mockResolvedValue({
      organization: { subscriptionStatus: "ACTIVE" },
    } as never)
    const guard = await requireOrgMember("org1", req())
    expect(guard).toMatchObject({ userId: "u1", role: "EMPLOYEE", orgId: "org1" })
    expect(mockEmployeeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "u1", organizationId: "org1", isActive: true }),
      }),
    )
  })

  it("rejects a user with neither membership nor employee record", async () => {
    mockMembershipFindFirst.mockResolvedValue(null)
    mockEmployeeFindFirst.mockResolvedValue(null)
    expect(await status(await requireOrgMember("org1", req()))).toBe(403)
  })

  it("blocks a cancelled org found via membership with 402", async () => {
    mockMembershipFindFirst.mockResolvedValue({
      organization: { subscriptionStatus: "CANCELED", trialEndsAt: null, pastDueSince: null },
    } as never)
    expect(await status(await requireOrgMember("org1", req()))).toBe(402)
  })

  it("blocks an expired trial found via membership with 402", async () => {
    mockMembershipFindFirst.mockResolvedValue({
      organization: {
        subscriptionStatus: "TRIALING",
        trialEndsAt: new Date(Date.now() - DAY),
        pastDueSince: null,
      },
    } as never)
    expect(await status(await requireOrgMember("org1", req()))).toBe(402)
  })
})

describe("requireManagerRole", () => {
  it("rejects EMPLOYEE with 403", () => {
    const guard: AuthGuard = { userId: "u1", role: "EMPLOYEE" }
    expect(requireManagerRole(guard)?.error.status).toBe(403)
  })

  it("allows MANAGER and ADMIN", () => {
    expect(requireManagerRole({ userId: "u1", role: "MANAGER" })).toBeNull()
    expect(requireManagerRole({ userId: "u1", role: "ADMIN" })).toBeNull()
  })
})
