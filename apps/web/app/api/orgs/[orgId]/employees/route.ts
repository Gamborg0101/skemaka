import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { isValidWage, isValidEmail, parsePaginationParams } from "@/lib/validate"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as employeeService from "@/lib/services/employeeService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const CreateEmployeeSchema = z.object({
  name:            z.string().min(1).max(200, "name must be at most 200 characters"),
  email:           z.string().refine(isValidEmail, "email must be a valid email address"),
  phone:           z.string().max(20, "phone must be at most 20 characters").optional(),
  jobRole:         z.string().min(1).max(100, "jobRole must be at most 100 characters"),
  hourlyWage:      z.number().refine(isValidWage, "hourlyWage must be a positive number up to 100000"),
  notes:           z.string().max(5000, "notes must be at most 5000 characters").optional(),
  employmentType:  z.string().optional(),
  contractedHours: z.number().int().min(0, "contractedHours must be a non-negative integer").optional(),
})

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const pagination = parsePaginationParams(req.nextUrl, { limit: 100, maxLimit: 500 })
  const status = req.nextUrl.searchParams.get("status")
  const filter =
    status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : undefined
  const result = await employeeService.listEmployees(orgId, pagination, filter)
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

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(req, CreateEmployeeSchema)
  if ("error" in parsed) return parsed.error

  try {
    const employee = await employeeService.createEmployee(orgId, parsed.data)
    return NextResponse.json({ data: employee }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
