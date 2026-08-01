import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as employeeService from "@/lib/services/employeeService"
import { recordAudit } from "@/lib/audit"
import { logError, requestIdFrom } from "@/lib/log"

interface RouteContext {
  params: Promise<{ orgId: string; employeeId: string }>
}

/**
 * GET /api/orgs/[orgId]/employees/[employeeId]/export
 *
 * GDPR data-subject access/portability export: returns all personal data held for
 * one employee as a downloadable JSON document. Manager-only; audit-logged.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId, employeeId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  try {
    const data = await employeeService.exportEmployeeData(orgId, employeeId)

    recordAudit({
      orgId,
      actorUserId: guard.userId,
      action: "EMPLOYEE_DATA_EXPORTED",
      entity: `Employee:${employeeId}`,
    })

    return NextResponse.json(data, {
      headers: {
        "Content-Disposition": `attachment; filename="employee-${employeeId}-export.json"`,
      },
    })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    }
    logError("employees/export", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to export employee data" }, { status: 500 })
  }
}
