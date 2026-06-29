import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { isValidWage, isValidEmail, isNonNegativeInt } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as employeeService from "@/lib/services/employeeService"
import type { Employee } from "@/types"

interface RouteContext {
  params: Promise<{ orgId: string; employeeId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId, employeeId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  let body: Partial<
    Pick<Employee, "name" | "email" | "phone" | "jobRole" | "hourlyWage" | "notes" | "isActive" | "employmentType" | "contractedHours">
  >
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (body.hourlyWage !== undefined && !isValidWage(body.hourlyWage)) {
    return NextResponse.json({ error: "hourlyWage must be a positive number up to 100000" }, { status: 400 })
  }
  if (body.email !== undefined && !isValidEmail(body.email)) {
    return NextResponse.json({ error: "email must be a valid email address" }, { status: 400 })
  }
  if (body.contractedHours !== undefined && !isNonNegativeInt(body.contractedHours)) {
    return NextResponse.json({ error: "contractedHours must be a non-negative integer" }, { status: 400 })
  }
  // String length caps — mirror the limits enforced on create (POST) so updates
  // can't bypass them and store oversized values.
  if (body.name !== undefined && (typeof body.name !== "string" || body.name.length === 0 || body.name.length > 200)) {
    return NextResponse.json({ error: "name must be between 1 and 200 characters" }, { status: 400 })
  }
  if (body.phone !== undefined && body.phone !== null && body.phone.length > 20) {
    return NextResponse.json({ error: "phone must be at most 20 characters" }, { status: 400 })
  }
  if (body.jobRole !== undefined && (typeof body.jobRole !== "string" || body.jobRole.length === 0 || body.jobRole.length > 100)) {
    return NextResponse.json({ error: "jobRole must be between 1 and 100 characters" }, { status: 400 })
  }
  if (body.notes !== undefined && body.notes !== null && body.notes.length > 5000) {
    return NextResponse.json({ error: "notes must be at most 5000 characters" }, { status: 400 })
  }

  try {
    const employee = await employeeService.updateEmployee(orgId, employeeId, body, guard.userId)
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
