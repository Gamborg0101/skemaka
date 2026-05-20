import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { isPositiveFiniteNumber, isNonNegativeInt, parsePaginationParams } from "@/lib/validate"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as employeeService from "@/lib/services/employeeService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const pagination = parsePaginationParams(req.nextUrl, { limit: 100, maxLimit: 500 })
  const result = await employeeService.listEmployees(orgId, pagination)
  return NextResponse.json(
    result,
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
  )
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers))
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const body = await req.json() as {
    name?: string; email?: string; phone?: string
    jobRole?: string; hourlyWage?: number; notes?: string
    employmentType?: string; contractedHours?: number
  }
  const { name, email, jobRole, hourlyWage, phone, notes, employmentType, contractedHours } = body

  if (!name || !email || !jobRole || hourlyWage === undefined) {
    return NextResponse.json(
      { error: "name, email, jobRole, and hourlyWage are required" },
      { status: 400 },
    )
  }
  if (!isPositiveFiniteNumber(hourlyWage)) {
    return NextResponse.json({ error: "hourlyWage must be a positive number" }, { status: 400 })
  }
  if (name.length > 200) return NextResponse.json({ error: "name must be at most 200 characters" }, { status: 400 })
  if (email.length > 254) return NextResponse.json({ error: "email must be at most 254 characters" }, { status: 400 })
  if (phone && phone.length > 20) return NextResponse.json({ error: "phone must be at most 20 characters" }, { status: 400 })
  if (notes && notes.length > 5000) return NextResponse.json({ error: "notes must be at most 5000 characters" }, { status: 400 })
  if (jobRole.length > 100) return NextResponse.json({ error: "jobRole must be at most 100 characters" }, { status: 400 })
  if (contractedHours !== undefined && !isNonNegativeInt(contractedHours)) {
    return NextResponse.json({ error: "contractedHours must be a non-negative integer" }, { status: 400 })
  }

  try {
    const employee = await employeeService.createEmployee(orgId, {
      name, email, phone, jobRole, hourlyWage, notes, employmentType, contractedHours,
    })
    return NextResponse.json({ data: employee }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
