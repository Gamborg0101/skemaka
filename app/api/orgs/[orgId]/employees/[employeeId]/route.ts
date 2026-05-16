import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { serEmployee } from "@/lib/serialize"
import { isEmploymentType } from "@/types"
import type { Employee } from "@/types"
import { isPositiveFiniteNumber, isNonNegativeInt } from "@/lib/validate"

interface RouteContext {
  params: Promise<{ orgId: string; employeeId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId, employeeId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const existing = await db.employee.findFirst({ where: { id: employeeId, organizationId: orgId } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as Partial<
    Pick<Employee, "name" | "email" | "phone" | "jobRole" | "hourlyWage" | "notes" | "isActive" | "employmentType" | "contractedHours">
  >

  if (body.hourlyWage !== undefined && !isPositiveFiniteNumber(body.hourlyWage)) {
    return NextResponse.json({ error: "hourlyWage must be a non-negative number" }, { status: 400 })
  }
  if (body.contractedHours !== undefined && !isNonNegativeInt(body.contractedHours)) {
    return NextResponse.json({ error: "contractedHours must be a non-negative integer" }, { status: 400 })
  }

  const employee = await db.employee.update({
    where: { id: employeeId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.jobRole !== undefined && { jobRole: body.jobRole }),
      ...(body.hourlyWage !== undefined && { hourlyWage: body.hourlyWage }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.employmentType !== undefined && isEmploymentType(body.employmentType) && { employmentType: body.employmentType }),
      ...(body.contractedHours !== undefined && { contractedHours: body.contractedHours }),
    },
  })

  return NextResponse.json({ data: serEmployee(employee) })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { orgId, employeeId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const existing = await db.employee.findFirst({ where: { id: employeeId, organizationId: orgId } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.employee.delete({ where: { id: employeeId } })

  if (existing.isActive) {
    await db.organization.update({
      where: { id: orgId },
      data: { employeeCount: { decrement: 1 } },
    })
  }

  return NextResponse.json({ data: { deleted: true } })
}
