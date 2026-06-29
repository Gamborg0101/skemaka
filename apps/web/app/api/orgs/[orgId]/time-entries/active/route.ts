import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { isNonNegativeInt } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as clockService from "@/lib/services/clockService"
import { getEmployeeByUserId, getEmployeeById } from "@/lib/services/employeeService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

// GET /api/orgs/[orgId]/time-entries/active
// Returns the current open time entry for the caller (or a specified employee for managers).
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const isManager = guard.role === "MANAGER" || guard.role === "ADMIN"
  let employeeId: string

  if (isManager) {
    const qEmployeeId = req.nextUrl.searchParams.get("employeeId")
    if (!qEmployeeId) {
      return NextResponse.json({ error: "employeeId query param is required" }, { status: 400 })
    }
    const emp = await getEmployeeById(orgId, qEmployeeId)
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    employeeId = qEmployeeId
  } else {
    const emp = await getEmployeeByUserId(orgId, guard.userId)
    if (!emp) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    employeeId = emp.id
  }

  const entry = await clockService.getActiveEntry(orgId, employeeId)
  return NextResponse.json({ data: entry ?? null })
}

// PATCH /api/orgs/[orgId]/time-entries/active  — clock out
// Employee: clocks out themselves (optional breakMinutes, note)
// Manager:  must provide employeeId; optional breakMinutes, note
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const isManager = guard.role === "MANAGER" || guard.role === "ADMIN"
  let body: {
    employeeId?: string; breakMinutes?: number; note?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (body.breakMinutes !== undefined && !isNonNegativeInt(body.breakMinutes)) {
    return NextResponse.json({ error: "breakMinutes must be a non-negative integer" }, { status: 400 })
  }
  if (body.note && body.note.length > 500) {
    return NextResponse.json({ error: "note must be at most 500 characters" }, { status: 400 })
  }

  let resolvedEmployeeId: string

  if (isManager) {
    if (!body.employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 })
    }
    const emp = await getEmployeeById(orgId, body.employeeId)
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    resolvedEmployeeId = body.employeeId
  } else {
    const emp = await getEmployeeByUserId(orgId, guard.userId)
    if (!emp) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    resolvedEmployeeId = emp.id
  }

  try {
    const entry = await clockService.clockOut(
      orgId, resolvedEmployeeId, body.breakMinutes, body.note ?? null,
    )
    return NextResponse.json({ data: entry })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
