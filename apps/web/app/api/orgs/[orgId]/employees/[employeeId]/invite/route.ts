import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as employeeService from "@/lib/services/employeeService"

interface RouteContext {
  params: Promise<{ orgId: string; employeeId: string }>
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId, employeeId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  try {
    const employee = await employeeService.refreshInviteToken(orgId, employeeId)
    return NextResponse.json({ data: employee })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
