import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"
import { classifyKeyword, suppressNumber, unsuppressNumber } from "@/lib/sms"
import { logError, logInfo, requestIdFrom } from "@/lib/log"

/**
 * POST /api/webhooks/twilio/sms
 *
 * Twilio inbound-message webhook. Handles STOP/START/HELP keywords so employees
 * can opt out (and back in) of SMS, maintaining our own suppression list on top
 * of Twilio's carrier-level Advanced Opt-Out. Public (Twilio calls it); secured
 * by validating the `X-Twilio-Signature` header against TWILIO_AUTH_TOKEN.
 *
 * Responds with TwiML so Twilio does not surface a delivery error.
 */
function twiml(message?: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
  return new NextResponse(body, { headers: { "Content-Type": "text/xml" } })
}

export async function POST(req: NextRequest) {
  const requestId = requestIdFrom(req.headers)
  const form = await req.formData()
  const params: Record<string, string> = {}
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value
  }

  // Verify the request really came from Twilio. The signature is computed over the
  // exact public URL Twilio called, reconstructed from the forwarded host/proto.
  // Fail CLOSED if the auth token is unconfigured — without it we cannot prove the
  // request came from Twilio, so an attacker could otherwise POST STOP/START to
  // suppress or re-subscribe arbitrary phone numbers.
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const signature = req.headers.get("x-twilio-signature")
  if (!authToken) {
    logError("twilio/sms", "TWILIO_AUTH_TOKEN is not set — rejecting request", { requestId })
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }
  const proto = req.headers.get("x-forwarded-proto") ?? "https"
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? ""
  const url = `${proto}://${host}${req.nextUrl.pathname}`
  const valid = signature
    ? twilio.validateRequest(authToken, signature, url, params)
    : false
  if (!valid) {
    logError("twilio/sms", "invalid Twilio signature", { requestId })
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
  }

  const from = params.From ?? ""
  const keyword = classifyKeyword(params.Body ?? "")
  if (!from || keyword === null) return twiml()

  try {
    if (keyword === "stop") {
      await suppressNumber(from)
      logInfo("twilio/sms", "number opted out", { requestId })
      return twiml()
    }
    if (keyword === "start") {
      await unsuppressNumber(from)
      logInfo("twilio/sms", "number opted back in", { requestId })
      return twiml("You're re-subscribed to Skemaka notifications. Reply STOP to opt out.")
    }
    // help
    return twiml("Skemaka schedule alerts. Reply STOP to opt out. Support: privacy@skemaka.com")
  } catch (err) {
    logError("twilio/sms", err, { requestId })
    return twiml()
  }
}
