import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { isValidDate } from "@/lib/validate"
import * as availabilityService from "@/lib/services/availabilityService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

/**
 * GET /api/orgs/[orgId]/availability/conflicts?weekStart=YYYY-MM-DD
 *
 * Returns the (employeeId, date) pairs employees marked unavailable for the week,
 * so the scheduler can warn when a manager assigns a conflicting shift. Read-only.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const weekStart = req.nextUrl.searchParams.get("weekStart")
  if (!weekStart) {
    return NextResponse.json({ error: "weekStart query param is required" }, { status: 400 })
  }
  if (!isValidDate(weekStart)) {
    return NextResponse.json({ error: "weekStart must be a valid YYYY-MM-DD date" }, { status: 400 })
  }

  const unavailable = await availabilityService.getWeekUnavailability(orgId, weekStart)
  return NextResponse.json(
    { data: unavailable },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } },
  )
}
