import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { isValidDate, parsePaginationParams } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as timeOffService from "@/lib/services/timeOffService"
import { getEmployeeByUserId, getEmployeeById } from "@/lib/services/employeeService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const isManager = guard.role === "MANAGER" || guard.role === "ADMIN"

  let employeeId: string | null = null
  if (!isManager) {
    const emp = await getEmployeeByUserId(orgId, guard.userId)
    if (!emp) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    employeeId = emp.id
  }

  const statusFilter     = req.nextUrl.searchParams.get("status") as "PENDING" | "APPROVED" | "DENIED" | null
  const employeeIdFilter = isManager ? req.nextUrl.searchParams.get("employeeId") : employeeId
  const weekStart        = req.nextUrl.searchParams.get("weekStart")

  if (weekStart && !isValidDate(weekStart)) {
    return NextResponse.json({ error: "weekStart must be a valid YYYY-MM-DD date" }, { status: 400 })
  }

  const pagination = parsePaginationParams(req.nextUrl, { limit: 50, maxLimit: 200 })

  try {
    const result = await timeOffService.listTimeOff(
      orgId,
      { status: statusFilter, employeeId: employeeIdFilter, weekStart: weekStart ?? null },
      pagination,
    )
    return NextResponse.json(
      result,
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } },
    )
  } catch (err) {
    console.error("[time-off GET]", err)
    return NextResponse.json({ error: "Failed to fetch time-off requests" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const { success } = await rateLimitRequest(getClientIp(req.headers))
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const isManager = guard.role === "MANAGER" || guard.role === "ADMIN"

  const body = await req.json() as {
    employeeId?: string; startDate?: string; endDate?: string; reason?: string
  }

  let resolvedEmployeeId: string

  if (isManager) {
    if (!body.employeeId || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: "employeeId, startDate, and endDate are required" },
        { status: 400 },
      )
    }
    const emp = await getEmployeeById(orgId, body.employeeId)
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    resolvedEmployeeId = body.employeeId
  } else {
    if (!body.startDate || !body.endDate) {
      return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 })
    }
    const emp = await getEmployeeByUserId(orgId, guard.userId)
    if (!emp) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    resolvedEmployeeId = emp.id
  }

  if (body.reason && body.reason.length > 2000) {
    return NextResponse.json({ error: "reason must be at most 2000 characters" }, { status: 400 })
  }

  if (!isValidDate(body.startDate!) || !isValidDate(body.endDate!)) {
    return NextResponse.json(
      { error: "startDate and endDate must be valid YYYY-MM-DD dates" },
      { status: 400 },
    )
  }

  try {
    const request = await timeOffService.createTimeOff(
      orgId,
      resolvedEmployeeId,
      body.startDate!,
      body.endDate!,
      body.reason ?? null,
    )
    return NextResponse.json({ data: request }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
