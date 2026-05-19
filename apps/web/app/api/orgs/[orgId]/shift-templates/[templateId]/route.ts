import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as orgService from "@/lib/services/orgService"

interface RouteContext {
  params: Promise<{ orgId: string; templateId: string }>
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { orgId, templateId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  try {
    await orgService.deleteShiftTemplate(orgId, templateId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
