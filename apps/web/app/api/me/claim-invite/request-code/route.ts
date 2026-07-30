/**
 * POST /api/me/claim-invite/request-code
 *
 * Step 1 of the two-step invite claim (F-2 hardening). Resolves the invite
 * token, generates a 6-digit verification code, stores it hashed, and emails it
 * to the EMPLOYEE'S record email — the authoritative address the manager
 * entered. This proves the claimant controls that inbox, so a forwarded or
 * leaked invite link is no longer enough to take over an employee identity.
 *
 * Request body: { token: string }
 *
 * Response:
 *   200 { data: { sent: true, email: "j•••@example.com" } }
 *   200 { data: { alreadyLinked: true, orgName } }   // already this user's — no code needed
 *   400 Missing/invalid body
 *   401 Not authenticated
 *   404 Token not found or expired
 *   409 Token already claimed by a different user
 *   429 Rate limited
 *
 * In non-production only, the response also includes `devCode` so local dev and
 * e2e can complete the flow without reading email. NEVER returned in production.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, parseBody } from "@/lib/apiGuard"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import { getClaimableEmployee } from "@/lib/services/employeeService"
import { generateClaimCode, storeClaimCode } from "@/lib/inviteClaimCode"
import { sendClaimCodeEmail } from "@/lib/resend"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { logError, requestIdFrom } from "@/lib/log"

/** "jane@example.com" → "j•••@example.com" — enough to recognise, not to reveal. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!domain) return "•••"
  const first = local.slice(0, 1)
  return `${first}•••@${domain}`
}

export async function POST(req: NextRequest) {
  const { success } = await rateLimitRequest(getClientIp(req.headers), "auth")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  const parsed = await parseBody(req, z.object({ token: z.string().min(1, "token is required") }))
  if ("error" in parsed) return parsed.error

  try {
    const employee = await getClaimableEmployee(parsed.data.token, guard.userId)

    // Already this user's invite — no verification needed; the claim endpoint is
    // idempotent for the linked user.
    if (employee.alreadyLinkedToUser) {
      return NextResponse.json({ data: { alreadyLinked: true, orgName: employee.orgName } })
    }

    const code = generateClaimCode()
    await storeClaimCode(employee.id, code)

    try {
      await sendClaimCodeEmail({
        to:      employee.email,
        name:    employee.name,
        orgName: employee.orgName,
        code,
        locale:  employee.locale,
      })
    } catch (err) {
      // Don't leak whether the address exists / delivery failed via status code;
      // log and report success. The user can re-request if it never arrives.
      logError("POST /api/me/claim-invite/request-code", err, {
        requestId: requestIdFrom(req.headers),
      })
    }

    return NextResponse.json({
      data: {
        sent:  true,
        email: maskEmail(employee.email),
        // Dev/e2e affordance only — gated on NODE_ENV, never present in prod.
        ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
      },
    })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    logError("POST /api/me/claim-invite/request-code", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to send code" }, { status: 500 })
  }
}
