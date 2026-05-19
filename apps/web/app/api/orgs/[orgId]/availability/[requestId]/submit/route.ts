import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { isValidDate, isValidTime } from "@/lib/validate"
import { db } from "@/lib/prisma"
import * as availabilityService from "@/lib/services/availabilityService"

interface RouteContext {
  params: Promise<{ orgId: string; requestId: string }>
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId, requestId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const employeeId = await availabilityService.getEmployeeIdForUser(orgId, guard.userId)
  if (!employeeId) {
    return NextResponse.json({ error: "Employee record not found" }, { status: 404 })
  }

  const request = await db.availabilityRequest.findFirst({
    where: { id: requestId, organizationId: orgId },
    select: { id: true, status: true },
    orderBy: { createdAt: "asc" },
  })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (request.status !== "OPEN") {
    return NextResponse.json({ error: "This request is no longer accepting submissions" }, { status: 409 })
  }

  const body = await req.json() as {
    days?: { date: string; isAvailable: boolean; preferredStart?: string; preferredEnd?: string }[]
  }
  const { days } = body

  if (!Array.isArray(days) || days.length === 0) {
    return NextResponse.json({ error: "days array is required" }, { status: 400 })
  }

  for (const day of days) {
    if (!isValidDate(day.date)) {
      return NextResponse.json({ error: `Invalid date: ${day.date}` }, { status: 400 })
    }
    if (typeof day.isAvailable !== "boolean") {
      return NextResponse.json({ error: "isAvailable must be a boolean" }, { status: 400 })
    }
    if (day.preferredStart != null && !isValidTime(day.preferredStart)) {
      return NextResponse.json({ error: `Invalid preferredStart: ${day.preferredStart}` }, { status: 400 })
    }
    if (day.preferredEnd != null && !isValidTime(day.preferredEnd)) {
      return NextResponse.json({ error: `Invalid preferredEnd: ${day.preferredEnd}` }, { status: 400 })
    }
  }

  await availabilityService.submitAvailability(requestId, employeeId, orgId, days)
  return NextResponse.json({ data: { submitted: true } }, { status: 201 })
}
