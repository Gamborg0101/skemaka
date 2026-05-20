import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { parsePaginationParams } from "@/lib/validate"
import * as availabilityService from "@/lib/services/availabilityService"

interface RouteContext {
  params: Promise<{ orgId: string; requestId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId, requestId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const pagination = parsePaginationParams(req.nextUrl, { limit: 100, maxLimit: 500 })
  const result = await availabilityService.listSubmissions(orgId, requestId, pagination)
  return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } })
}
