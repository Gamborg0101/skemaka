import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { isPositiveFiniteNumber, isNonNegativeInt } from "@/lib/validate"
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

  const body = await req.json() as Partial<
    Pick<Employee, "name" | "email" | "phone" | "jobRole" | "hourlyWage" | "notes" | "isActive" | "employmentType" | "contractedHours">
  >

  if (body.hourlyWage !== undefined && !isPositiveFiniteNumber(body.hourlyWage)) {
    return NextResponse.json({ error: "hourlyWage must be a non-negative number" }, { status: 400 })
  }
  if (body.contractedHours !== undefined && !isNonNegativeInt(body.contractedHours)) {
    return NextResponse.json({ error: "contractedHours must be a non-negative integer" }, { status: 400 })
  }

  try {
    const employee = await employeeService.updateEmployee(orgId, employeeId, body)
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

  try {
    await employeeService.deleteEmployee(orgId, employeeId)
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
