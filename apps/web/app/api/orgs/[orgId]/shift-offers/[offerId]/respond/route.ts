import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as shiftOfferService from "@/lib/services/shiftOfferService"

interface RouteContext {
  params: Promise<{ orgId: string; offerId: string }>
}

// POST — a recipient accepts or declines a shift offer. Body: { response }.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId, offerId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(
    req,
    z.object({ response: z.enum(["ACCEPTED", "DECLINED"]) }),
  )
  if ("error" in parsed) return parsed.error

  try {
    const data = await shiftOfferService.respondToOffer(orgId, guard.userId, offerId, parsed.data.response)
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
