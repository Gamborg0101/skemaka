/**
 * POST /api/me/claim-invite
 *
 * Links the authenticated user to the employee record identified by an invite
 * token.  Works for both web (cookie session) and mobile (Bearer token) clients.
 *
 * Request body: { token: string }
 *
 * Response:
 *   200  { data: { organizationId, employeeId, employeeName, orgName } }
 *   400  Missing / invalid body
 *   401  Not authenticated
 *   404  Token not found or expired
 *   409  Token already claimed by a different user
 *   429  Rate limited
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiGuard"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import { claimInvite } from "@/lib/services/employeeService"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { logError, requestIdFrom } from "@/lib/log"

export async function POST(req: NextRequest) {
  // ── 1. Rate-limit ──────────────────────────────────────────────────────────
  const { success } = await rateLimitRequest(getClientIp(req.headers), "auth")
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  // ── 2. Auth ────────────────────────────────────────────────────────────────
  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  const { userId } = guard

  // ── 3. Parse body ──────────────────────────────────────────────────────────
  let body: { token?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { token } = body
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token is required" }, { status: 400 })
  }

  // ── 4. Claim ───────────────────────────────────────────────────────────────
  try {
    const result = await claimInvite(token, userId)
    return NextResponse.json({ data: result })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    logError("POST /api/me/claim-invite", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to claim invite" }, { status: 500 })
  }
}
