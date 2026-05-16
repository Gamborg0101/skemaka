import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { serAvailabilitySubmission } from "@/lib/serialize"

interface RouteContext {
  params: Promise<{ orgId: string; requestId: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { orgId, requestId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const submissions = await db.availabilitySubmission.findMany({
    where: { requestId, organizationId: orgId },
    include: { employee: { select: { id: true, name: true, jobRole: true } }, days: { orderBy: { date: "asc" } } },
    orderBy: { submittedAt: "asc" },
  })

  return NextResponse.json({ data: submissions.map(serAvailabilitySubmission) })
}
