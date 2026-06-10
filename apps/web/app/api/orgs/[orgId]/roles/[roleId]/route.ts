import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
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

  const body = await req.json() as { name?: string }
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (body.name.trim().length > 100) {
    return NextResponse.json({ error: "name must be at most 100 characters" }, { status: 400 })
  }

  try {
    const role = await orgService.renameJobRole(orgId, roleId, body.name.trim())
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
