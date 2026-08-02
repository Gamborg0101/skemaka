import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as clockService from "@/lib/services/clockService"
import { getEmployeeByUserId, getEmployeeById } from "@/lib/services/employeeService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const ClockOutSchema = z.object({
  employeeId:   z.string().optional(),
  breakMinutes: z.number().int().min(0, "must be a non-negative integer").optional(),
  note:         z.string().max(500, "note must be at most 500 characters").nullable().optional(),
})

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

  const parsed = await parseBody(req, ClockOutSchema)
  if ("error" in parsed) return parsed.error
  const body = parsed.data

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
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
