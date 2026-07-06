import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { db } from "@/lib/prisma"
import { canAccessOrg, type BillingBlock, type BillingSnapshot } from "@/lib/billing"
import { isSuperadmin } from "@/lib/platform"
import { writeAudit } from "@/lib/services/auditService"
import type { UserRole, SubscriptionStatus } from "@/types"

type GuardOptions = { allowSuspended?: boolean }

export type AuthGuard = {
  userId: string
  role: UserRole
  orgId?: string
  subscriptionStatus?: SubscriptionStatus
  email?: string | null
  name?: string | null
}

/** JWT timestamp claims are stored as epoch millis; decode back to a Date. */
function dateFromClaim(value: unknown): Date | null {
  return typeof value === "number" ? new Date(value) : null
}

/** Build the 402 payment-required response for a billing block. */
function billingBlocked(block: BillingBlock): { error: Response } {
  return { error: NextResponse.json({ error: block.message, code: block.code }, { status: 402 }) }
}

/** Read the authoritative (Stripe-synced) billing fields straight from the DB. */
async function loadOrgBilling(orgId: string): Promise<BillingSnapshot | null> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { subscriptionStatus: true, trialEndsAt: true, pastDueSince: true },
  })
  if (!org) return null
  return {
    status: org.subscriptionStatus as SubscriptionStatus,
    trialEndsAt: org.trialEndsAt,
    pastDueSince: org.pastDueSince,
  }
}

/**
 * Decide access from a snapshot, but never deny on a possibly-stale JWT: if the
 * snapshot would block, re-check the authoritative DB first so a just-subscribed
 * customer is never wrongly locked out. Returns a 402 error or null (allowed).
 */
async function enforceBilling(
  orgId: string,
  snapshot: BillingSnapshot,
): Promise<{ error: Response } | null> {
  const block = canAccessOrg(snapshot)
  if (!block) return null

  const fresh = await loadOrgBilling(orgId)
  if (!fresh) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }

  const freshBlock = canAccessOrg(fresh)
  return freshBlock ? billingBlocked(freshBlock) : null
}

/** Returns a 403 response when the guard's role is not MANAGER or ADMIN. */
export function requireManagerRole(guard: AuthGuard): { error: Response } | null {
  if (guard.role !== "MANAGER" && guard.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return null
}

function jwtCookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET environment variable is not set")
  return secret
}

async function decodeSessionToken(req: NextRequest) {
  const cookieName = jwtCookieName()
  const secret = getAuthSecret()

  // Cookie path — web clients
  const fromCookie = await getToken({ req, secret, salt: cookieName, cookieName })
  if (fromCookie) return fromCookie

  // Bearer path — mobile clients (NextAuth 5 does not auto-check Authorization header)
  const authHeader = req.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const { decode } = await import("next-auth/jwt")
    try {
      return await decode({ token: authHeader.slice(7), secret, salt: cookieName })
    } catch {
      return null
    }
  }

  return null
}

export async function requireAuth(req: NextRequest): Promise<{ error: Response } | AuthGuard> {
  const token = await decodeSessionToken(req)
  if (!token?.sub) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return {
    userId: token.sub,
    role: (token.role as UserRole) ?? "EMPLOYEE",
    orgId: token.orgId as string | undefined,
    subscriptionStatus: token.subscriptionStatus as SubscriptionStatus | undefined,
    email: (token.email as string | null | undefined) ?? null,
    name: (token.name as string | null | undefined) ?? null,
  }
}

export async function requireOrgMember(
  orgId: string,
  req: NextRequest,
  options: GuardOptions = {},
): Promise<{ error: Response } | AuthGuard> {
  const token = await decodeSessionToken(req)
  if (!token?.sub) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const userId            = token.sub
  const role              = (token.role as UserRole) ?? "EMPLOYEE"
  const tokenOrgId        = token.orgId as string | undefined
  const subscriptionStatus = token.subscriptionStatus as SubscriptionStatus | undefined
  const email             = (token.email as string | null | undefined) ?? null
  const name              = (token.name as string | null | undefined) ?? null
  const { allowSuspended = false } = options

  // Super-admin cross-restaurant access. Fires only when the super admin targets
  // a restaurant that ISN'T their own (their own org still runs the normal path
  // below, billing and all). Bypasses membership + billing so the super admin can
  // help any customer, including past-due ones. Isolation is unaffected: the
  // caller still operates strictly on `orgId` — this only authorizes, it never
  // changes which org is targeted. Every mutation is audited (fire-and-forget).
  if (isSuperadmin(email) && tokenOrgId !== orgId) {
    const method = req.method.toUpperCase()
    if (method !== "GET" && method !== "HEAD") {
      void writeAudit({
        actorUserId:    userId,
        actorEmail:     email!,
        organizationId: orgId,
        action:         "MUTATE",
        method,
        path:           req.nextUrl.pathname,
      })
    }
    return { userId, role: "ADMIN", orgId, subscriptionStatus: undefined, email, name }
  }

  // Fast path: orgId is cached in the JWT — no DB roundtrip on the happy path.
  if (tokenOrgId) {
    if (tokenOrgId !== orgId) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
    }
    if (!allowSuspended) {
      // Prefer the JWT billing claims; fall back to the DB for legacy tokens
      // issued before the billing fields were embedded.
      const snapshot: BillingSnapshot = subscriptionStatus
        ? {
            status: subscriptionStatus,
            trialEndsAt: dateFromClaim(token.trialEndsAt),
            pastDueSince: dateFromClaim(token.pastDueSince),
          }
        : (await loadOrgBilling(orgId)) ?? { status: "CANCELED", trialEndsAt: null, pastDueSince: null }
      const blocked = await enforceBilling(orgId, snapshot)
      if (blocked) return blocked
    }
    return { userId, role, orgId: tokenOrgId, subscriptionStatus, email, name }
  }

  // Slow path: check manager membership first (covers new managers whose token
  // predates the orgId claim), then fall back to employee record lookup.
  const membership = await db.membership.findFirst({
    where: { userId, organizationId: orgId, role: "MANAGER" },
    include: {
      organization: { select: { subscriptionStatus: true, trialEndsAt: true, pastDueSince: true } },
    },
    orderBy: { joinedAt: "asc" },
  })
  if (membership) {
    if (!allowSuspended) {
      // Authoritative DB data already in hand — decide directly, no re-check.
      const block = canAccessOrg({
        status: membership.organization.subscriptionStatus as SubscriptionStatus,
        trialEndsAt: membership.organization.trialEndsAt,
        pastDueSince: membership.organization.pastDueSince,
      })
      if (block) return billingBlocked(block)
    }
    return {
      userId,
      role: "MANAGER",
      orgId,
      subscriptionStatus: membership.organization.subscriptionStatus as SubscriptionStatus,
      email,
      name,
    }
  }

  // Employee fallback: authenticated users with an active Employee record in
  // this org can access employee-facing routes. Routes that require manager
  // privileges check guard.role themselves.
  const employee = await db.employee.findFirst({
    where: { userId, organizationId: orgId, isActive: true },
    include: {
      organization: { select: { subscriptionStatus: true, trialEndsAt: true, pastDueSince: true } },
    },
    orderBy: { createdAt: "asc" },
  })
  if (!employee) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  if (!allowSuspended) {
    // Authoritative DB data already in hand — decide directly, no re-check.
    const block = canAccessOrg({
      status: employee.organization.subscriptionStatus as SubscriptionStatus,
      trialEndsAt: employee.organization.trialEndsAt,
      pastDueSince: employee.organization.pastDueSince,
    })
    if (block) return billingBlocked(block)
  }
  return {
    userId,
    role: "EMPLOYEE" as UserRole,
    orgId,
    subscriptionStatus: employee.organization.subscriptionStatus as SubscriptionStatus,
    email,
    name,
  }
}
