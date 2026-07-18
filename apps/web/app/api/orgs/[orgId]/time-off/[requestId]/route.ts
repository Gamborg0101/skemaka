import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as timeOffService from "@/lib/services/timeOffService"

interface RouteContext {
  params: Promise<{ orgId: string; requestId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId, requestId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  let body: { status?: "APPROVED" | "DENIED"; reviewNote?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body.status || !["APPROVED", "DENIED"].includes(body.status)) {
    return NextResponse.json({ error: "status must be APPROVED or DENIED" }, { status: 400 })
  }
  if (body.reviewNote && body.reviewNote.length > 2000) {
    return NextResponse.json({ error: "reviewNote must be at most 2000 characters" }, { status: 400 })
  }

  try {
    const updated = await timeOffService.reviewTimeOff(orgId, requestId, body.status, body.reviewNote)
    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { orgId, requestId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  try {
    await timeOffService.deleteTimeOff(orgId, requestId)
    return NextResponse.json({ data: null })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
