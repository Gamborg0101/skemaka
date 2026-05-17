import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { serEmployee, serAvailabilityRequest } from "@/lib/serialize"
import { isValidDate, isValidTime } from "@/lib/validate"
import type { Employee, AvailabilityRequest } from "@/types"

interface RouteContext {
  params: Promise<{ token: string }>
}

interface ValidatedToken {
  employeeId: string
  organizationId: string
  requestId: string
  employee: Employee
  request: AvailabilityRequest
  orgName: string
}

async function validateToken(token: string): Promise<ValidatedToken | null> {
  const employee = await db.employee.findFirst({
    where: { inviteToken: token, isActive: true },
  })
  if (!employee) return null

  const request = await db.availabilityRequest.findFirst({
    where: { organizationId: employee.organizationId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
  })
  if (!request) return null

  const org = await db.organization.findUnique({
    where: { id: employee.organizationId },
    select: { name: true },
  })

  return {
    employeeId: employee.id,
    organizationId: employee.organizationId,
    requestId: request.id,
    employee: serEmployee(employee),
    request: serAvailabilityRequest(request),
    orgName: org?.name ?? "",
  }
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { success } = await rateLimitRequest(getClientIp(req.headers))
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const { token } = await params

  const validated = await validateToken(token)
  if (!validated) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 })
  }

  return NextResponse.json(
    {
      data: {
        employee: validated.employee,
        request: validated.request,
        orgName: validated.orgName,
      },
    },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } }
  )
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { success } = await rateLimitRequest(getClientIp(req.headers))
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const { token } = await params

  const validated = await validateToken(token)
  if (!validated) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 })
  }

  if (validated.request.status !== "OPEN") {
    return NextResponse.json(
      { error: "This availability request is no longer accepting submissions" },
      { status: 409 }
    )
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
    if (day.preferredStart !== undefined && day.preferredStart !== null && !isValidTime(day.preferredStart)) {
      return NextResponse.json({ error: `Invalid preferredStart: ${day.preferredStart}` }, { status: 400 })
    }
    if (day.preferredEnd !== undefined && day.preferredEnd !== null && !isValidTime(day.preferredEnd)) {
      return NextResponse.json({ error: `Invalid preferredEnd: ${day.preferredEnd}` }, { status: 400 })
    }
  }

  const submission = await db.availabilitySubmission.upsert({
    where: {
      requestId_employeeId: {
        requestId: validated.requestId,
        employeeId: validated.employeeId,
      },
    },
    create: {
      requestId: validated.requestId,
      employeeId: validated.employeeId,
      organizationId: validated.organizationId,
    },
    update: { submittedAt: new Date() },
  })

  await db.availabilityDay.deleteMany({ where: { submissionId: submission.id } })
  await db.availabilityDay.createMany({
    data: days.map((d) => ({
      submissionId: submission.id,
      date: new Date(d.date),
      isAvailable: d.isAvailable,
      preferredStart: d.preferredStart ?? null,
      preferredEnd: d.preferredEnd ?? null,
    })),
  })

  return NextResponse.json({ data: { submitted: true } }, { status: 201 })
}
