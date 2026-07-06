import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { SUPPORTED_CURRENCIES } from "@/lib/orgSettings"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as orgService from "@/lib/services/orgService"
import { logError, requestIdFrom } from "@/lib/log"

const VALID_CURRENCY_CODES = new Set(SUPPORTED_CURRENCIES.map((c) => c.code))

export async function PATCH(req: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  let body: {
    currency?: string
    name?: string; country?: string; timezone?: string; locale?: string
    industry?: string; timeFormat?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { currency, name, country, timezone, locale, industry, timeFormat } = body
  const hasProfile =
    name !== undefined || country !== undefined || timezone !== undefined ||
    locale !== undefined || industry !== undefined || timeFormat !== undefined

  if (currency === undefined && !hasProfile) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }
  if (currency !== undefined && !VALID_CURRENCY_CODES.has(currency)) {
    return NextResponse.json({ error: "Invalid currency code" }, { status: 400 })
  }
  // Profile validation mirrors the create route (POST /api/orgs).
  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    return NextResponse.json({ error: "name cannot be empty" }, { status: 400 })
  }
  if (name !== undefined && name.length > 100) {
    return NextResponse.json({ error: "name must be at most 100 characters" }, { status: 400 })
  }
  const tooLong = (s: unknown, max: number) => typeof s === "string" && s.length > max
  if (tooLong(country, 8) || tooLong(timezone, 64) || tooLong(locale, 16) || tooLong(industry, 32)) {
    return NextResponse.json({ error: "Invalid profile field" }, { status: 400 })
  }
  if (timeFormat !== undefined && timeFormat !== "12h" && timeFormat !== "24h") {
    return NextResponse.json({ error: "timeFormat must be '12h' or '24h'" }, { status: 400 })
  }

  try {
    let org
    // Currency first (it also FX-converts wages); then descriptive profile fields.
    if (currency !== undefined) {
      org = await orgService.updateOrgCurrency(orgId, currency, guard.userId)
    }
    if (hasProfile) {
      org = await orgService.updateOrgProfile(orgId, {
        name, country, timezone, locale, industry,
        timeFormat: timeFormat as "12h" | "24h" | undefined,
      })
    }
    return NextResponse.json({ data: org })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    logError("orgs PATCH", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 })
  }
}
