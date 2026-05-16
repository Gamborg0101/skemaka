import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { auth } from "@/lib/auth"
import { serTimeOffRequest } from "@/lib/serialize"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { isValidDate } from "@/lib/validate"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isManager = session.user.orgId === orgId
  let employeeId: string | null = null

  if (!isManager) {
    const emp = await db.employee.findFirst({
      where: { organizationId: orgId, userId: session.user.id },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
    if (!emp) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    employeeId = emp.id
  }

  const statusFilter = req.nextUrl.searchParams.get("status") as "PENDING" | "APPROVED" | "DENIED" | null
  const employeeIdFilter = isManager ? req.nextUrl.searchParams.get("employeeId") : employeeId
  const weekStart = req.nextUrl.searchParams.get("weekStart")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { organizationId: orgId }
  if (statusFilter) where.status = statusFilter
  if (employeeIdFilter) where.employeeId = employeeIdFilter

  // If weekStart is provided, return requests that overlap the week (Mon–Sun)
  if (weekStart) {
    const start = new Date(weekStart + "T00:00:00Z")
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 6)
    where.startDate = { lte: end }
    where.endDate = { gte: start }
  }

  const requests = await db.timeOffRequest.findMany({
    where,
    include: { employee: { select: { id: true, name: true, jobRole: true } } },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ data: requests.map(serTimeOffRequest) })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { success } = await rateLimitRequest(getClientIp(req.headers))
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const isManager = session.user.orgId === orgId
  let resolvedEmployeeId: string

  if (isManager) {
    const body = await req.json() as { employeeId?: string; startDate?: string; endDate?: string; reason?: string }
    if (!body.employeeId || !body.startDate || !body.endDate) {
      return NextResponse.json({ error: "employeeId, startDate, and endDate are required" }, { status: 400 })
    }
    resolvedEmployeeId = body.employeeId
    return createRequest(orgId, resolvedEmployeeId, body.startDate, body.endDate, body.reason ?? null)
  }

  const emp = await db.employee.findFirst({
    where: { organizationId: orgId, userId: session.user.id },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })
  if (!emp) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json() as { startDate?: string; endDate?: string; reason?: string }
  if (!body.startDate || !body.endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 })
  }
  return createRequest(orgId, emp.id, body.startDate, body.endDate, body.reason ?? null)
}

async function createRequest(
  orgId: string,
  employeeId: string,
  startDate: string,
  endDate: string,
  reason: string | null,
) {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return NextResponse.json({ error: "startDate and endDate must be valid YYYY-MM-DD dates" }, { status: 400 })
  }

  const start = new Date(startDate + "T00:00:00Z")
  const end = new Date(endDate + "T00:00:00Z")

  if (end < start) {
    return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 })
  }

  const overlap = await db.timeOffRequest.findFirst({
    where: {
      employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
    orderBy: { createdAt: "asc" },
  })
  if (overlap) {
    return NextResponse.json(
      { error: "A pending or approved request already overlaps these dates" },
      { status: 409 }
    )
  }

  const request = await db.timeOffRequest.create({
    data: { organizationId: orgId, employeeId, startDate: start, endDate: end, reason },
    include: { employee: { select: { id: true, name: true, jobRole: true } } },
  })

  return NextResponse.json({ data: serTimeOffRequest(request) }, { status: 201 })
}
