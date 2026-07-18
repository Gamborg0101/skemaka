import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as shiftOfferService from "@/lib/services/shiftOfferService"

interface RouteContext {
  params: Promise<{ orgId: string; offerId: string }>
}

const ConfirmOfferSchema = z.object({
  employeeId: z.string().min(1, "employeeId is required"),
})

// POST — manager confirms one accepter; creates & assigns the shift. Body: { employeeId }.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId, offerId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(req, ConfirmOfferSchema)
  if ("error" in parsed) return parsed.error

  try {
    const data = await shiftOfferService.confirmOffer(orgId, guard.userId, offerId, parsed.data.employeeId)
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
