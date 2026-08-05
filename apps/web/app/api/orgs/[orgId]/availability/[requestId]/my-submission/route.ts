import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { db } from "@/lib/prisma"
import { serAvailabilitySubmission } from "@/lib/serialize"
import * as availabilityService from "@/lib/services/availabilityService"

interface RouteContext {
  params: Promise<{ orgId: string; requestId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId, requestId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  // Shared with the submit route so a prefill and a save can never disagree
  // about who the caller is — matched on the linked account first, email
  // second. A userId-only filter here silently returned "no submission" for an
  // employee who had in fact already answered, and the form reopened blank.
  const employeeId = await availabilityService.getEmployeeIdForUser(orgId, guard.userId, guard.email)

  if (!employeeId) {
    return NextResponse.json({ data: null })
  }

  const submission = await db.availabilitySubmission.findFirst({
    where: { requestId, employeeId, organizationId: orgId },
    orderBy: { submittedAt: "desc" },
    include: { days: { orderBy: { date: "asc" } } },
  })

  return NextResponse.json({ data: submission ? serAvailabilitySubmission(submission) : null })
}
