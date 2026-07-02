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

  const [employee, org] = await Promise.all([
    db.employee.findFirst({
      where: { organizationId: orgId, userId: guard.userId },
      select: { id: true, name: true, email: true, phone: true, jobRole: true },
      orderBy: { createdAt: "asc" },
    }),
    db.organization.findUnique({ where: { id: orgId }, select: { settings: true, industry: true } }),
  ])

  if (!employee) {
    return NextResponse.json({ error: "Employee record not found" }, { status: 404 })
  }

  const timeFormat = (org?.settings as { timeFormat?: "12h" | "24h" } | null)?.timeFormat ?? "24h"

  return NextResponse.json({ ...employee, timeFormat, industry: org?.industry ?? null })
}
