/**
 * POST /api/auth/mobile/refresh
 *
 * Validates the caller's current JWT and issues a new one with a fresh
 * expiry window. Call this before the token expires to stay authenticated
 * without going through the OAuth flow again.
 *
 * Request:
 *   Authorization: Bearer <current_token>
 *   (no body required)
 *
 * Response:
 *   { token: string, expiresIn: number, expiresAt: number }
 *
 * The returned token replaces the previous one — store it in
 * Keychain / Keystore and use it for subsequent API calls.
 *
 * Mobile refresh strategy:
 *   - Call this endpoint proactively every ~20 minutes (before the 30-min window closes)
 *   - On HTTP 401 from any API endpoint, refresh and retry once
 *   - If refresh also returns 401, return to the OAuth login flow
 *
 * Notes:
 *   - Subscription status is re-fetched from the database on every refresh,
 *     so billing changes take effect within one refresh cycle.
 *   - Mobile tokens have the same 30-minute window as web tokens.
 *     Use MOBILE_TOKEN_MAX_AGE env var to override (seconds).
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiGuard"
import { getToken, encode } from "next-auth/jwt"
import { db } from "@/lib/prisma"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"

const MOBILE_MAX_AGE = parseInt(
  process.env.MOBILE_TOKEN_MAX_AGE ?? String(30 * 60),
  10,
)

function cookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"
}

export async function POST(req: NextRequest) {
  const { success } = await rateLimitRequest(getClientIp(req.headers))
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  const name = cookieName()

  // Get the full decoded payload so we can preserve all claims (name, email, etc.)
  const decoded = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? "",
    salt: name,
    cookieName: name,
  })

  if (!decoded?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Re-fetch subscription status from the DB so the new token reflects
  // any billing changes since the last sign-in / refresh.
  let subscriptionStatus = guard.subscriptionStatus
  const orgId = guard.orgId
  if (orgId) {
    // Re-validate that this user still has access to the org. A removed manager
    // or deactivated employee must not be able to refresh into a fresh token.
    // Pure DB check — no Redis dependency. Note: employees have no Membership
    // row, so they pass via the active-employee branch; managers via membership.
    const [membership, activeEmployee] = await Promise.all([
      db.membership.findUnique({
        where: { userId_organizationId: { userId: decoded.sub!, organizationId: orgId } },
        select: { role: true },
      }),
      db.employee.findFirst({
        where: { userId: decoded.sub!, organizationId: orgId, isActive: true },
        select: { id: true },
      }),
    ])
    if (!membership && !activeEmployee) {
      return NextResponse.json(
        { error: "Access revoked", code: "ACCESS_REVOKED" },
        { status: 401 },
      )
    }
    // Recompute role so a demoted manager loses MANAGER on the next refresh.
    // Preserve ADMIN (superadmin is set via email match, not via membership).
    if (decoded.role !== "ADMIN") {
      decoded.role = membership?.role === "MANAGER" ? "MANAGER" : "EMPLOYEE"
    }

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { subscriptionStatus: true },
    })
    if (org) subscriptionStatus = org.subscriptionStatus as typeof subscriptionStatus

    if (subscriptionStatus === "CANCELED") {
      return NextResponse.json(
        { error: "Subscription cancelled", code: "SUBSCRIPTION_CANCELED" },
        { status: 402 },
      )
    }
  }

  const newToken = await encode({
    token: {
      ...decoded,
      subscriptionStatus,
    },
    secret: process.env.AUTH_SECRET ?? "",
    salt: name,
    maxAge: MOBILE_MAX_AGE,
  })

  const expiresAt = Math.floor(Date.now() / 1000) + MOBILE_MAX_AGE

  return NextResponse.json({
    token: newToken,
    expiresIn: MOBILE_MAX_AGE,
    expiresAt,
  })
}
