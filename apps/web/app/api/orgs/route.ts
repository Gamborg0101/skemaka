import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as orgService from "@/lib/services/orgService"
import { logError, requestIdFrom } from "@/lib/log"

const CreateOrgSchema = z.object({
  name:       z.string().refine((s) => s.trim().length > 0, "name is required").refine((s) => s.length <= 100, "name must be at most 100 characters"),
  currency:   z.string().optional(),
  country:    z.string().max(8,  "Invalid onboarding profile field").optional(),
  timezone:   z.string().max(64, "Invalid onboarding profile field").optional(),
  locale:     z.string().max(16, "Invalid onboarding profile field").optional(),
  industry:   z.string().max(32, "Invalid onboarding profile field").optional(),
  // Any value other than "12h"/"24h" is silently dropped (normalized below).
  timeFormat: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const parsed = await parseBody(req, CreateOrgSchema)
  if ("error" in parsed) return parsed.error
  const { name, currency, country, timezone, locale, industry, timeFormat } = parsed.data

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
