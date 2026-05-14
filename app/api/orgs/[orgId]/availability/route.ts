import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { AvailabilityRequest } from "@/types"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const mockRequests: AvailabilityRequest[] = [
  {
    id: "avreq_mock_001",
    organizationId: "org_mock_001",
    weekStart: "2025-05-19",
    deadline: "2025-05-16T23:59:59.000Z",
    status: "OPEN",
    createdAt: "2025-05-10T09:00:00.000Z",
  },
  {
    id: "avreq_mock_002",
    organizationId: "org_mock_001",
    weekStart: "2025-05-12",
    deadline: "2025-05-09T23:59:59.000Z",
    status: "CLOSED",
    createdAt: "2025-05-03T09:00:00.000Z",
  },
]

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params

  // TODO: replace with DB query
  // const requests = await db.availabilityRequest.findMany({
  //   where: { organizationId: orgId },
  //   orderBy: { weekStart: "desc" },
  // })

  const requests = mockRequests.filter((r) => r.organizationId === orgId || orgId === "org_mock_001")

  return NextResponse.json({ data: requests })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const body = await req.json() as { weekStart?: string; deadline?: string }
  const { weekStart, deadline } = body

  if (!weekStart || !deadline) {
    return NextResponse.json({ error: "weekStart and deadline are required" }, { status: 400 })
  }

  const now = new Date().toISOString()

  // TODO: send Resend emails to all active employees with their magic link
  // const request = await db.availabilityRequest.create({
  //   data: { organizationId: orgId, weekStart: new Date(weekStart), deadline: new Date(deadline) },
  // })
  // const employees = await db.employee.findMany({
  //   where: { organizationId: orgId, isActive: true },
  // })
  // await Promise.all(employees.map((emp) => {
  //   const availUrl = `${process.env.NEXT_PUBLIC_APP_URL}/availability/${emp.inviteToken}?requestId=${request.id}`
  //   return sendInviteEmail({ to: emp.email, name: emp.name, orgName: "...", inviteUrl: availUrl })
  // }))

  const mockRequest: AvailabilityRequest = {
    id: `avreq_mock_${Date.now()}`,
    organizationId: orgId,
    weekStart,
    deadline,
    status: "OPEN",
    createdAt: now,
  }

  return NextResponse.json({ data: mockRequest }, { status: 201 })
}
