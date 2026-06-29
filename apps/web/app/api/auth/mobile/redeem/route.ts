/**
 * POST /api/auth/mobile/redeem
 *
 * Exchanges a short-lived one-time auth code (issued by GET /api/auth/mobile/session
 * in redirect mode) for the actual session JWT.
 *
 * The code is a signed JWT that expires after 2 minutes. It contains the session
 * token as a claim. This prevents the long-lived session token from appearing in
 * server access logs or browser history.
 *
 * Request body: { code: string }
 * Response: { token: string }
 */
import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { decode } from "next-auth/jwt"
import { rateLimitRequest, getClientIp, getRedis } from "@/lib/upstash"

export async function POST(req: NextRequest) {
  const { success } = await rateLimitRequest(getClientIp(req.headers), "auth")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  let body: { code?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { code } = body
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "code is required" }, { status: 400 })
  }

  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set")

  try {
    const { payload } = await jwtVerify(code, new TextEncoder().encode(secret))

    if (
      payload.type !== "mobile_auth_code" ||
      typeof payload.sessionToken !== "string" ||
      !payload.sessionToken ||
      typeof payload.jti !== "string"
    ) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 })
    }

    // Enforce single-use: atomically claim the jti in Redis (SET NX with 2-min TTL).
    // If Redis is unavailable we fall through — a degraded but functional state.
    const redis = getRedis()
    if (redis) {
      const key = `auth:code:${payload.jti}`
      // SET NX returns "OK" on first use, null if the key already exists
      const claimed = await redis.set(key, "1", { nx: true, ex: 120 })
      if (claimed === null) {
        return NextResponse.json({ error: "Code already used" }, { status: 400 })
      }
    }

    const sessionToken = payload.sessionToken as string

    // Decode the session token so the mobile app gets the JWT claims
    // without needing to decrypt the NextAuth JWE itself (which it can't do).
    const cookieName = process.env.NODE_ENV === "production"
      ? "__Secure-authjs.session-token"
      : "authjs.session-token"
    let userId: string | null = null
    let orgId:  string | null = null
    let role:   string        = "EMPLOYEE"
    try {
      const decoded = await decode({ token: sessionToken, secret, salt: cookieName })
      userId = decoded?.sub                          ?? null
      orgId  = (decoded?.orgId as string | undefined) ?? null
      role   = (decoded?.role  as string | undefined) ?? "EMPLOYEE"
    } catch {
      // Non-fatal — the token is still valid for API calls; mobile hooks will
      // stay disabled until the user re-authenticates if claims are missing.
    }

    return NextResponse.json({ token: sessionToken, userId, orgId, role })
  } catch {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 })
  }
}
