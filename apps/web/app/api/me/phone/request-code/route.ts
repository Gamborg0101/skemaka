/**
 * POST /api/me/phone/request-code
 *
 * Step 1 of employee phone verification. The authenticated employee submits a
 * phone number; we generate a 6-digit code, store it hashed (keyed by userId,
 * "phone" scope), and text it to the number via Twilio. Proving control of the
 * handset is what makes the number trustworthy for a manager to call.
 *
 * Request body: { phone: string }   // E.164, e.g. "+4520123456"
 *
 * Response:
 *   200 { data: { sent: true, phone: "+45•••••3456" } }
 *   400 Missing/invalid body or malformed phone
 *   401 Not authenticated
 *   403 Caller has no employee record to attach the number to
 *   429 Rate limited
 *
 * In non-production the response also includes `devCode` so local dev and e2e
 * can complete the flow without a real handset. NEVER returned in production.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiGuard"
import { db } from "@/lib/prisma"
import { generateClaimCode, storeClaimCode } from "@/lib/inviteClaimCode"
import { normalizePhone, sendPhoneVerificationSms } from "@/lib/sms"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { logError, requestIdFrom } from "@/lib/log"

/** E.164: leading "+" then 8–15 digits. Returns the normalized value or null. */
function toE164(raw: string): string | null {
  const normalized = normalizePhone(raw)
  return /^\+\d{8,15}$/.test(normalized) ? normalized : null
}

/** "+4520123456" → "+45•••••3456" — enough to recognise, not to reveal. */
function maskPhone(phone: string): string {
  if (phone.length <= 7) return "•••"
  return `${phone.slice(0, 3)}${"•".repeat(phone.length - 7)}${phone.slice(-4)}`
}

export async function POST(req: NextRequest) {
  const { success } = await rateLimitRequest(getClientIp(req.headers), "auth")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  let body: { phone?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.phone || typeof body.phone !== "string") {
    return NextResponse.json({ error: "phone is required" }, { status: 400 })
  }
  const phone = toE164(body.phone)
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid phone number including country code, e.g. +4520123456" },
      { status: 400 },
    )
  }

  try {
    // Resolve the caller's employee record — needed for the org name in the SMS
    // and to confirm they're actually an employee who should verify a number.
    const employee = await db.employee.findFirst({
      where: { userId: guard.userId, isActive: true },
      orderBy: { createdAt: "asc" },
      include: { organization: { select: { name: true } } },
    })
    if (!employee) {
      return NextResponse.json({ error: "No employee record to verify" }, { status: 403 })
    }

    const code = generateClaimCode()
    await storeClaimCode(guard.userId, code, "phone")
    const delivered = await sendPhoneVerificationSms({ to: phone, code, orgName: employee.organization.name })

    // In production a failed/unconfigured send must not be reported as "sent" —
    // otherwise the user waits forever for a code that will never arrive. In
    // dev/e2e we proceed regardless, since devCode lets the flow complete
    // without a real handset.
    if (!delivered && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "We couldn't send a code to that number. Check it and try again." },
        { status: 502 },
      )
    }

    return NextResponse.json({
      data: {
        sent: true,
        phone: maskPhone(phone),
        // Dev/e2e affordance only — gated on NODE_ENV, never present in prod.
        ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
      },
    })
  } catch (err) {
    logError("POST /api/me/phone/request-code", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to send code" }, { status: 500 })
  }
}
