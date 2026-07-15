import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as shiftOfferService from "@/lib/services/shiftOfferService"

interface RouteContext {
  params: Promise<{ orgId: string; offerId: string }>
}

// POST — manager confirms one accepter; creates & assigns the shift. Body: { employeeId }.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId, offerId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  let body: { employeeId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (typeof body.employeeId !== "string") {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 })
  }

  try {
    const data = await shiftOfferService.confirmOffer(orgId, guard.userId, offerId, body.employeeId)
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
