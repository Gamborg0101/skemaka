import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as coverService from "@/lib/services/coverService"

interface RouteContext {
  params: Promise<{ orgId: string; requestId: string }>
}

// POST — a teammate offers to cover the shift (pending manager approval).
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId, requestId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  try {
    const data = await coverService.claimCoverRequest(orgId, guard.userId, requestId)
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
