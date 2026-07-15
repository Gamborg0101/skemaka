import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import * as employeeService from "@/lib/services/employeeService"

interface RouteContext {
  params: Promise<{ orgId: string; employeeId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId, employeeId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const data = await employeeService.listSickDays(orgId, employeeId)
  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } },
  )
}
