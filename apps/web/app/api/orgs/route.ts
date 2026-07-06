import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as orgService from "@/lib/services/orgService"
import { logError, requestIdFrom } from "@/lib/log"

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  let body: {
    name?: string; currency?: string
    country?: string; timezone?: string; locale?: string; industry?: string
    timeFormat?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const { name, currency, country, timezone, locale, industry, timeFormat } = body

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (name.length > 100) {
    return NextResponse.json({ error: "name must be at most 100 characters" }, { status: 400 })
  }
  // Optional profile fields — length-limit to avoid storing junk in settings.
  const tooLong = (s: unknown, max: number) => typeof s === "string" && s.length > max
  if (tooLong(country, 8) || tooLong(timezone, 64) || tooLong(locale, 16) || tooLong(industry, 32)) {
    return NextResponse.json({ error: "Invalid onboarding profile field" }, { status: 400 })
  }
  const normalizedTimeFormat = timeFormat === "12h" || timeFormat === "24h" ? timeFormat : undefined

  try {
    const org = await orgService.createOrg(guard.userId, {
      name, currency,
      country: country?.trim() || undefined,
      timezone: timezone?.trim() || undefined,
      locale: locale?.trim() || undefined,
      industry: industry?.trim() || undefined,
      timeFormat: normalizedTimeFormat,
      userEmail: guard.email,
      userName: guard.name,
    })
    return NextResponse.json({ data: org }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    logError("orgs POST", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 })
  }
}
