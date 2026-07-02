/**
 * POST /api/me/phone/verify
 *
 * Step 2 of employee phone verification. Verifies the 6-digit SMS code (keyed by
 * userId, "phone" scope) and, on success, stores the normalized number and marks
 * it verified on ALL of the caller's employee records — one person has one phone
 * across every org they work in.
 *
 * Request body: { phone: string, code: string }
 *
 * Response:
 *   200 { data: { verified: true } }
 *   400 Missing/invalid body, malformed phone, wrong or expired code
 *   401 Not authenticated
 *   403 Caller has no employee record
 *   429 Rate limited / too many incorrect attempts
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiGuard"
import { db } from "@/lib/prisma"
import { verifyClaimCode } from "@/lib/inviteClaimCode"
import { normalizePhone } from "@/lib/sms"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { logError, requestIdFrom } from "@/lib/log"

function toE164(raw: string): string | null {
  const normalized = normalizePhone(raw)
  return /^\+\d{8,15}$/.test(normalized) ? normalized : null
}

export async function POST(req: NextRequest) {
  const { success } = await rateLimitRequest(getClientIp(req.headers), "auth")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  let body: { phone?: unknown; code?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const phone = typeof body.phone === "string" ? toE164(body.phone) : null
  if (!phone) {
    return NextResponse.json({ error: "A valid phone number is required" }, { status: 400 })
  }
  if (!body.code || typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) {
    return NextResponse.json({ error: "A 6-digit verification code is required" }, { status: 400 })
  }

  try {
    const verdict = await verifyClaimCode(guard.userId, body.code, "phone")
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

    const now = new Date()
    const { count } = await db.employee.updateMany({
      where: { userId: guard.userId },
      data: { phone, phoneVerifiedAt: now, smsConsentAt: now },
    })
    if (count === 0) {
      return NextResponse.json({ error: "No employee record to verify" }, { status: 403 })
    }

    return NextResponse.json({ data: { verified: true } })
  } catch (err) {
    logError("POST /api/me/phone/verify", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to verify code" }, { status: 500 })
  }
}
