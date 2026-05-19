import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { db } from "@/lib/prisma"
import type { UserRole, SubscriptionStatus } from "@/types"

type GuardOptions = { allowSuspended?: boolean }

export type AuthGuard = {
  userId: string
  role: UserRole
  orgId?: string
  subscriptionStatus?: SubscriptionStatus
}

function jwtCookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"
}

async function decodeSessionToken(req: NextRequest) {
  const cookieName = jwtCookieName()
  return getToken({
    req,
    secret: process.env.AUTH_SECRET ?? "",
    salt: cookieName,
    cookieName,
  })
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
  const { allowSuspended = false } = options

  // Fast path: orgId is cached in the JWT — no DB roundtrip needed.
  if (tokenOrgId) {
    if (tokenOrgId !== orgId) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
    }
    if (!allowSuspended && subscriptionStatus === "CANCELED") {
      return {
        error: NextResponse.json(
          { error: "Subscription cancelled", code: "SUBSCRIPTION_CANCELED" },
          { status: 402 }
        ),
      }
    }
    return { userId, role, orgId: tokenOrgId, subscriptionStatus }
  }

  // Slow path: check manager membership first (covers new managers whose token
  // predates the orgId claim), then fall back to employee record lookup.
  const membership = await db.membership.findFirst({
    where: { userId, organizationId: orgId, role: "MANAGER" },
    include: { organization: { select: { subscriptionStatus: true } } },
    orderBy: { joinedAt: "asc" },
  })
  if (membership) {
    if (!allowSuspended && membership.organization.subscriptionStatus === "CANCELED") {
      return {
        error: NextResponse.json(
          { error: "Subscription cancelled", code: "SUBSCRIPTION_CANCELED" },
          { status: 402 }
        ),
      }
    }
    return {
      userId,
      role: "MANAGER",
      orgId,
      subscriptionStatus: membership.organization.subscriptionStatus as SubscriptionStatus,
    }
  }

  // Employee fallback: authenticated users with an active Employee record in
  // this org can access employee-facing routes. Routes that require manager
  // privileges check guard.role themselves.
  const employee = await db.employee.findFirst({
    where: { userId, organizationId: orgId, isActive: true },
    include: { organization: { select: { subscriptionStatus: true } } },
    orderBy: { createdAt: "asc" },
  })
  if (!employee) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  if (!allowSuspended && employee.organization.subscriptionStatus === "CANCELED") {
    return {
      error: NextResponse.json(
        { error: "Subscription cancelled", code: "SUBSCRIPTION_CANCELED" },
        { status: 402 }
      ),
    }
  }
  return {
    userId,
    role: "EMPLOYEE" as UserRole,
    orgId,
    subscriptionStatus: employee.organization.subscriptionStatus as SubscriptionStatus,
  }
}
