import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import * as orgService from "@/lib/services/orgService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const roles = await orgService.listRoles(orgId)
  return NextResponse.json(
    { data: roles },
    { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" } },
  )
}
