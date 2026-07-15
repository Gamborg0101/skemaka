import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { isValidColorTag } from "@/lib/validate"
import * as orgService from "@/lib/services/orgService"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"

interface RouteContext {
  params: Promise<{ orgId: string; roleId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId, roleId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  let body: { name?: string; color?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const hasName = body.name !== undefined
  const hasColor = body.color !== undefined
  if (!hasName && !hasColor) {
    return NextResponse.json({ error: "Provide a name and/or color to update" }, { status: 400 })
  }
  if (hasName && (typeof body.name !== "string" || !body.name.trim())) {
    return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 })
  }
  if (hasName && body.name!.trim().length > 100) {
    return NextResponse.json({ error: "name must be at most 100 characters" }, { status: 400 })
  }
  if (hasColor && (typeof body.color !== "string" || !isValidColorTag(body.color))) {
    return NextResponse.json({ error: "Invalid color" }, { status: 400 })
  }

  try {
    const role = await orgService.updateJobRole(orgId, roleId, {
      ...(hasName ? { name: body.name!.trim() } : {}),
      ...(hasColor ? { color: body.color } : {}),
    })
    return NextResponse.json({ data: role })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { orgId, roleId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success: deleteOk } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!deleteOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  try {
    await orgService.deleteJobRole(orgId, roleId)
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
