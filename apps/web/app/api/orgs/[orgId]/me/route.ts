import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { db } from "@/lib/prisma"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const employee = await db.employee.findFirst({
    where: { organizationId: orgId, userId: guard.userId },
    select: { id: true, name: true, email: true, phone: true, jobRole: true },
    orderBy: { createdAt: "asc" },
  })

  if (!employee) {
    return NextResponse.json({ error: "Employee record not found" }, { status: 404 })
  }

  return NextResponse.json(employee)
}
