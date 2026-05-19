import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as timeOffService from "@/lib/services/timeOffService"

interface RouteContext {
  params: Promise<{ orgId: string; requestId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId, requestId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  if (guard.role !== "MANAGER" && guard.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as { status?: "APPROVED" | "DENIED"; reviewNote?: string }
  if (!body.status || !["APPROVED", "DENIED"].includes(body.status)) {
    return NextResponse.json({ error: "status must be APPROVED or DENIED" }, { status: 400 })
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

  if (guard.role !== "MANAGER" && guard.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

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
