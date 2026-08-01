import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { SUPPORTED_CURRENCIES } from "@/lib/orgSettings"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as orgService from "@/lib/services/orgService"
import { logError, requestIdFrom } from "@/lib/log"

const VALID_CURRENCY_CODES = new Set(SUPPORTED_CURRENCIES.map((c) => c.code))

const UpdateOrgSchema = z
  .object({
    currency:   z.string().refine((c) => VALID_CURRENCY_CODES.has(c), "Invalid currency code").optional(),
    // Untrimmed like the original; reject whitespace-only, cap raw length at 100.
    name:       z.string()
                  .refine((s) => s.trim().length > 0, "name cannot be empty")
                  .refine((s) => s.length <= 100, "name must be at most 100 characters")
                  .optional(),
    country:    z.string().max(8,  "Invalid profile field").optional(),
    timezone:   z.string().max(64, "Invalid profile field").optional(),
    locale:     z.string().max(16, "Invalid profile field").optional(),
    industry:   z.string().max(32, "Invalid profile field").optional(),
    timeFormat: z.enum(["12h", "24h"], { message: "timeFormat must be '12h' or '24h'" }).optional(),
  })
  .refine(
    (b) =>
      b.currency !== undefined || b.name !== undefined || b.country !== undefined ||
      b.timezone !== undefined || b.locale !== undefined || b.industry !== undefined ||
      b.timeFormat !== undefined,
    { message: "No fields to update" },
  )

export async function PATCH(req: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(req, UpdateOrgSchema)
  if ("error" in parsed) return parsed.error

  const { currency, name, country, timezone, locale, industry, timeFormat } = parsed.data
  const hasProfile =
    name !== undefined || country !== undefined || timezone !== undefined ||
    locale !== undefined || industry !== undefined || timeFormat !== undefined

  try {
    let org
    // Currency first (it also FX-converts wages); then descriptive profile fields.
    if (currency !== undefined) {
      org = await orgService.updateOrgCurrency(orgId, currency, guard.userId)
    }
    if (hasProfile) {
      org = await orgService.updateOrgProfile(orgId, {
        name, country, timezone, locale, industry, timeFormat,
      })
    }
    return NextResponse.json({ data: org })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    }
    logError("orgs PATCH", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 })
  }
}
