import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { serAvailabilityRequest } from "@/lib/serialize"
import { sendAvailabilityInviteEmail } from "@/lib/resend"
import { isValidDate } from "@/lib/validate"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const requests = await db.availabilityRequest.findMany({
    where: { organizationId: orgId },
    orderBy: { weekStart: "desc" },
  })

  return NextResponse.json(
    { data: requests.map(serAvailabilityRequest) },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } }
  )
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const body = await req.json() as { weekStart?: string; deadline?: string }
  const { weekStart, deadline } = body

  if (!weekStart || !deadline) {
    return NextResponse.json({ error: "weekStart and deadline are required" }, { status: 400 })
  }
  if (!isValidDate(weekStart) || !isValidDate(deadline)) {
    return NextResponse.json({ error: "weekStart and deadline must be valid dates" }, { status: 400 })
  }

  const request = await db.availabilityRequest.create({
    data: {
      organizationId: orgId,
      weekStart: new Date(weekStart),
      deadline: new Date(deadline),
    },
  })

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  })

  const employees = await db.employee.findMany({
    where: { organizationId: orgId, isActive: true, inviteToken: { not: null } },
    select: { email: true, name: true, inviteToken: true },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const weekLabel = new Date(weekStart).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const deadlineLabel = new Date(deadline).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  void Promise.allSettled(
    employees.map((emp) =>
      sendAvailabilityInviteEmail({
        to: emp.email,
        name: emp.name,
        orgName: org?.name ?? "",
        availabilityUrl: `${appUrl}/availability/${emp.inviteToken}`,
        weekLabel,
        deadline: deadlineLabel,
      })
    )
  )

  return NextResponse.json({ data: serAvailabilityRequest(request) }, { status: 201 })
}
