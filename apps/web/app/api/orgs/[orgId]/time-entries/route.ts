import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, parseBody } from "@/lib/apiGuard"
import { isValidDate, parsePaginationParams } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as clockService from "@/lib/services/clockService"
import { getEmployeeByUserId, getEmployeeById } from "@/lib/services/employeeService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const ClockInSchema = z.object({
  employeeId: z.string().optional(),
  shiftId:    z.string().optional(),
  note:       z.string().max(500, "note must be at most 500 characters").optional(),
})

// GET /api/orgs/[orgId]/time-entries
// Managers see all entries (filterable). Employees see only their own.
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const isManager = guard.role === "MANAGER" || guard.role === "ADMIN"

  let employeeIdFilter = isManager
    ? req.nextUrl.searchParams.get("employeeId")
    : null

  if (!isManager) {
    const emp = await getEmployeeByUserId(orgId, guard.userId)
    if (!emp) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    employeeIdFilter = emp.id
  }

  const dateFrom = req.nextUrl.searchParams.get("dateFrom")
  const dateTo   = req.nextUrl.searchParams.get("dateTo")
  const openOnly = req.nextUrl.searchParams.get("open")

  if (dateFrom && !isValidDate(dateFrom)) {
    return NextResponse.json({ error: "dateFrom must be YYYY-MM-DD" }, { status: 400 })
  }
  if (dateTo && !isValidDate(dateTo)) {
    return NextResponse.json({ error: "dateTo must be YYYY-MM-DD" }, { status: 400 })
  }

  const filter: clockService.TimeEntryFilter = {
    employeeId: employeeIdFilter,
    dateFrom:   dateFrom ?? null,
    dateTo:     dateTo   ?? null,
    open:       openOnly === "true" ? true : openOnly === "false" ? false : undefined,
  }

  const pagination = parsePaginationParams(req.nextUrl, { limit: 50, maxLimit: 200 })
  const result = await clockService.listTimeEntries(orgId, filter, pagination)
  return NextResponse.json(result)
}

// POST /api/orgs/[orgId]/time-entries  — clock in
// Employee: clocks in themselves (optional shiftId, note in body)
// Manager:  must provide employeeId; optional shiftId, note
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const isManager = guard.role === "MANAGER" || guard.role === "ADMIN"

  const parsed = await parseBody(req, ClockInSchema)
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
    const entry = await clockService.clockIn(orgId, resolvedEmployeeId, body.shiftId, body.note)
    return NextResponse.json({ data: entry }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
