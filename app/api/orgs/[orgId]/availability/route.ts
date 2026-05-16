import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { serAvailabilityRequest } from "@/lib/serialize"

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

  return NextResponse.json({ data: requests.map(serAvailabilityRequest) })
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

  const request = await db.availabilityRequest.create({
    data: {
      organizationId: orgId,
      weekStart: new Date(weekStart),
      deadline: new Date(deadline),
    },
  })

  // TODO: send Resend emails to all active employees with their magic link
  // const employees = await db.employee.findMany({
  //   where: { organizationId: orgId, isActive: true },
  // })
  // await Promise.all(employees.map((emp) => {
  //   const availUrl = `${process.env.NEXT_PUBLIC_APP_URL}/availability/${emp.inviteToken}?requestId=${request.id}`
  //   return sendInviteEmail({ to: emp.email, name: emp.name, orgName: org.name, inviteUrl: availUrl })
  // }))

  return NextResponse.json({ data: serAvailabilityRequest(request) }, { status: 201 })
}
