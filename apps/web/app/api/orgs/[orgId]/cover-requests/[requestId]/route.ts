import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as coverService from "@/lib/services/coverService"

interface RouteContext {
  params: Promise<{ orgId: string; requestId: string }>
}

// DELETE — the requester withdraws their own cover request.
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { orgId, requestId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  try {
    const data = await coverService.cancelCoverRequest(orgId, guard.userId, requestId)
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          messageKey: err.messageKey,
          ...(err.messageParams ? { messageParams: err.messageParams } : {}),
        },
        { status: serviceErrorStatus(err.code) },
      )
    }
    throw err
  }
}
