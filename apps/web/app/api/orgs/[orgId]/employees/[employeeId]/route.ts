import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { isValidWage, isValidEmail } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as employeeService from "@/lib/services/employeeService"

interface RouteContext {
  params: Promise<{ orgId: string; employeeId: string }>
}

const UpdateEmployeeSchema = z.object({
  name:            z.string().min(1, "name must be between 1 and 200 characters").max(200, "name must be between 1 and 200 characters").optional(),
  email:           z.string().refine(isValidEmail, "email must be a valid email address").optional(),
  phone:           z.string().max(20, "phone must be at most 20 characters").nullable().optional(),
  jobRole:         z.string().min(1, "jobRole must be between 1 and 100 characters").max(100, "jobRole must be between 1 and 100 characters").optional(),
  hourlyWage:      z.number().refine(isValidWage, "hourlyWage must be a positive number up to 100000").optional(),
  notes:           z.string().max(5000, "notes must be at most 5000 characters").nullable().optional(),
  isActive:        z.boolean().optional(),
  employmentType:  z.string().optional(),
  contractedHours: z.number().int().min(0, "contractedHours must be a non-negative integer").optional(),
})

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId, employeeId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  // String length caps mirror the limits enforced on create (POST) so updates
  // can't bypass them and store oversized values.
  const parsed = await parseBody(req, UpdateEmployeeSchema)
  if ("error" in parsed) return parsed.error

  try {
    const employee = await employeeService.updateEmployee(orgId, employeeId, parsed.data, guard.userId)
    return NextResponse.json({ data: employee })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { orgId, employeeId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  try {
    await employeeService.deleteEmployee(orgId, employeeId, guard.userId)
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
