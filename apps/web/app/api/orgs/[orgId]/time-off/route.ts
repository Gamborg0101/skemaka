import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, parseBody } from "@/lib/apiGuard"
import { isValidDate, parsePaginationParams } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as timeOffService from "@/lib/services/timeOffService"
import { getEmployeeByUserId, getEmployeeById } from "@/lib/services/employeeService"
import { logError, requestIdFrom } from "@/lib/log"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const CreateTimeOffSchema = z
  .object({
    employeeId: z.string().optional(),
    startDate:  z.string().refine(isValidDate, "must be a valid YYYY-MM-DD date"),
    endDate:    z.string().refine(isValidDate, "must be a valid YYYY-MM-DD date"),
    reason:     z.string().max(2000, "reason must be at most 2000 characters").optional(),
  })
  .refine((b) => b.endDate >= b.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  })

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
    logError("time-off GET", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to fetch time-off requests" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const isManager = guard.role === "MANAGER" || guard.role === "ADMIN"

  const parsed = await parseBody(req, CreateTimeOffSchema)
  if ("error" in parsed) return parsed.error
  const body = parsed.data

  let resolvedEmployeeId: string

  if (body.employeeId) {
    // Creating a request on behalf of another employee — manager-only.
    if (!isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const emp = await getEmployeeById(orgId, body.employeeId)
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    resolvedEmployeeId = body.employeeId
  } else {
    // Self-service request (portal) — resolve the caller's own employee record.
    // Works for plain employees and for managers who are also employees.
    const emp = await getEmployeeByUserId(orgId, guard.userId)
    if (!emp) {
      return NextResponse.json(
        { error: "No employee record found for your account. Specify an employee." },
        { status: 403 },
      )
    }
    resolvedEmployeeId = emp.id
  }

  try {
    const request = await timeOffService.createTimeOff(
      orgId,
      resolvedEmployeeId,
      body.startDate,
      body.endDate,
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
