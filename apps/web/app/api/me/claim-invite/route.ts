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
import { z } from "zod"
import { requireAuth, parseBody } from "@/lib/apiGuard"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import { claimInvite, getClaimableEmployee } from "@/lib/services/employeeService"
import { verifyClaimCode } from "@/lib/inviteClaimCode"
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
  const parsed = await parseBody(
    req,
    z.object({ token: z.string().min(1, "token is required"), code: z.string().optional() }),
  )
  if ("error" in parsed) return parsed.error
  const { token, code } = parsed.data

  // ── 4. Verify the emailed code, then claim ───────────────────────────────────
  // The code (sent to the employee's record email by /request-code) proves the
  // caller controls that inbox, so a forwarded/leaked link can't claim the
  // identity. Skipped only when the invite is already linked to this same user
  // (idempotent re-claim — no code was issued).
  try {
    const employee = await getClaimableEmployee(token, userId)

    if (!employee.alreadyLinkedToUser) {
      if (!code || !/^\d{6}$/.test(code)) {
        return NextResponse.json({ error: "A 6-digit verification code is required" }, { status: 400 })
      }
      const verdict = await verifyClaimCode(employee.id, code)
      if (!verdict.ok) {
        const message =
          verdict.reason === "too_many"
            ? "Too many incorrect attempts. Request a new code."
            : verdict.reason === "expired"
              ? "That code has expired. Request a new one."
              : "Incorrect code."
        const status = verdict.reason === "too_many" ? 429 : 400
        return NextResponse.json({ error: message, code: verdict.reason }, { status })
      }
    }

    const result = await claimInvite(token, userId)
    return NextResponse.json({ data: result })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          messageKey: err.messageKey,
          ...(err.messageParams ? { messageParams: err.messageParams } : {}),
        },
        { status: serviceErrorStatus(err.code) },
      )
    }
    logError("POST /api/me/claim-invite", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to claim invite" }, { status: 500 })
  }
}
