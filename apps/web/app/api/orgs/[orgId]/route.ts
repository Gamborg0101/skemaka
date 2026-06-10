import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { SUPPORTED_CURRENCIES } from "@/lib/orgSettings"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as orgService from "@/lib/services/orgService"

const VALID_CURRENCY_CODES = new Set(SUPPORTED_CURRENCIES.map((c) => c.code))

export async function PATCH(req: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const body = await req.json() as { currency?: string }

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
    console.error("[orgs PATCH]", err)
    return NextResponse.json({ error: "Failed to update currency" }, { status: 500 })
  }
}
