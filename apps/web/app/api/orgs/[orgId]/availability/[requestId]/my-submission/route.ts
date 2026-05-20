import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { db } from "@/lib/prisma"
import { serAvailabilitySubmission } from "@/lib/serialize"

interface RouteContext {
  params: Promise<{ orgId: string; requestId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId, requestId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const employee = await db.employee.findFirst({
    where: { organizationId: orgId, userId: guard.userId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })

  if (!employee) {
    return NextResponse.json({ data: null })
  }

  const submission = await db.availabilitySubmission.findFirst({
    where: { requestId, employeeId: employee.id, organizationId: orgId },
    orderBy: { submittedAt: "desc" },
    include: { days: { orderBy: { date: "asc" } } },
  })

  return NextResponse.json({ data: submission ? serAvailabilitySubmission(submission) : null })
}
