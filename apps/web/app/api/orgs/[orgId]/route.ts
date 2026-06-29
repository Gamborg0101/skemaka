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

  let body: { currency?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (body.currency === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }
  if (!VALID_CURRENCY_CODES.has(body.currency)) {
    return NextResponse.json({ error: "Invalid currency code" }, { status: 400 })
  }

  try {
    const org = await orgService.updateOrgCurrency(orgId, body.currency, guard.userId)
    return NextResponse.json({ data: org })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    logError("orgs PATCH", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to update currency" }, { status: 500 })
  }
}
