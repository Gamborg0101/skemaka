import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { serEmployee } from "@/lib/serialize"
import { isEmploymentType } from "@/types"
import { isPositiveFiniteNumber, isNonNegativeInt } from "@/lib/validate"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const employees = await db.employee.findMany({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(
    { data: employees.map(serEmployee) },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } }
  )
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

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
      { status: 400 }
    )
  }

  if (!isPositiveFiniteNumber(hourlyWage)) {
    return NextResponse.json({ error: "hourlyWage must be a non-negative number" }, { status: 400 })
  }
  if (contractedHours !== undefined && !isNonNegativeInt(contractedHours)) {
    return NextResponse.json({ error: "contractedHours must be a non-negative integer" }, { status: 400 })
  }

  const existing = await db.employee.findUnique({
    where: { organizationId_email: { organizationId: orgId, email } },
  })
  if (existing) {
    return NextResponse.json({ error: "An employee with this email already exists" }, { status: 409 })
  }

  const resolvedType = employmentType && isEmploymentType(employmentType) ? employmentType : "PART_TIME"

  const employee = await db.employee.create({
    data: {
      organizationId: orgId,
      name,
      email,
      phone: phone ?? null,
      jobRole,
      hourlyWage,
      employmentType: resolvedType,
      contractedHours: contractedHours ?? 0,
      notes: notes ?? null,
      inviteToken: crypto.randomUUID(),
      inviteExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  await db.organization.update({
    where: { id: orgId },
    data: { employeeCount: { increment: 1 } },
  })

  return NextResponse.json({ data: serEmployee(employee) }, { status: 201 })
}
