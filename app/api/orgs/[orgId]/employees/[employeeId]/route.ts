import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { Employee } from "@/types"

interface RouteContext {
  params: Promise<{ orgId: string; employeeId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgId, employeeId } = await params

  const body = await req.json() as Partial<
    Pick<Employee, "name" | "email" | "phone" | "jobRole" | "hourlyWage" | "notes" | "isActive">
  >

  const now = new Date().toISOString()

  // TODO: replace with DB query
  // const employee = await db.employee.update({
  //   where: { id: employeeId, organizationId: orgId },
  //   data: { ...body, updatedAt: new Date() },
  // })

  const mockEmployee: Employee = {
    id: employeeId,
    organizationId: orgId,
    userId: null,
    name: body.name ?? "Alice Hansen",
    email: body.email ?? "alice@example.com",
    phone: body.phone ?? null,
    jobRole: body.jobRole ?? "Barista",
    hourlyWage: body.hourlyWage ?? 15.5,
    employmentType: "PART_TIME",
    contractedHours: 0,
    notes: body.notes ?? null,
    isActive: body.isActive ?? true,
    inviteToken: null,
    inviteExpiry: null,
    createdAt: "2025-01-01T08:00:00.000Z",
    updatedAt: now,
  }

  return NextResponse.json({ data: mockEmployee })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgId, employeeId } = await params
  const now = new Date().toISOString()

  // TODO: update DB + Stripe subscription quantity

  const mockEmployee: Employee = {
    id: employeeId,
    organizationId: orgId,
    userId: null,
    name: "Alice Hansen",
    email: "alice@example.com",
    phone: null,
    jobRole: "Barista",
    hourlyWage: 15.5,
    employmentType: "PART_TIME",
    contractedHours: 0,
    notes: null,
    isActive: false,
    inviteToken: null,
    inviteExpiry: null,
    createdAt: "2025-01-01T08:00:00.000Z",
    updatedAt: now,
  }

  return NextResponse.json({ data: mockEmployee })
}
