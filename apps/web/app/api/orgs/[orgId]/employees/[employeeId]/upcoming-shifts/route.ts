import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import * as employeeService from "@/lib/services/employeeService"

interface RouteContext {
  params: Promise<{ orgId: string; employeeId: string }>
}

/**
 * GET /api/orgs/[orgId]/employees/[employeeId]/upcoming-shifts
 *
 * This employee's future (today or later), non-cancelled shifts, published or
 * draft. Powers the "N upcoming shifts" warning in the deactivate-employee
 * dialog — deactivating alone hides the employee from the schedule but leaves
 * these shifts in place, so the manager needs to see what's at stake.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId, employeeId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const data = await employeeService.listUpcomingShifts(orgId, employeeId)
  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } },
  )
}
