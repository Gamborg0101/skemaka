import { NextRequest, NextResponse } from "next/server"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import type { Employee, AvailabilityRequest } from "@/types"

interface RouteContext {
  params: Promise<{ token: string }>
}

interface TokenValidationResponse {
  employee: Employee
  request: AvailabilityRequest
}

interface SubmitAvailabilityBody {
  days: {
    date: string
    isAvailable: boolean
    preferredStart?: string
    preferredEnd?: string
  }[]
}

// Validates the token and returns the associated employee + availability request.
// Returns null if the token is invalid, expired, or has no open request.
// TODO: replace with real DB lookup when DB is connected.
async function validateToken(token: string): Promise<TokenValidationResponse | null> {
  // TODO: DB lookup — replace the mock below with:
  // const employee = await db.employee.findUnique({ where: { inviteToken: token } })
  // if (!employee || !employee.isActive) return null
  // if (employee.inviteExpiry && new Date(employee.inviteExpiry) < new Date()) return null
  // const request = await db.availabilityRequest.findFirst({
  //   where: { organizationId: employee.organizationId, status: "OPEN" },
  //   orderBy: { createdAt: "desc" },
  // })
  // if (!request) return null
  // return { employee, request }

  if (token !== "mock_invite_token") {
    return null
  }

  const mockEmployee: Employee = {
    id: "emp_mock_001",
    organizationId: "org_mock_001",
    userId: null,
    name: "Alice Hansen",
    email: "alice@example.com",
    phone: "+45 12 34 56 78",
    jobRole: "Barista",
    hourlyWage: 155,
    notes: null,
    employmentType: "PART_TIME" as const,
    contractedHours: 0,
    isActive: true,
    inviteToken: token,
    inviteExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: "2025-01-01T08:00:00.000Z",
    updatedAt: "2025-01-01T08:00:00.000Z",
  }

  const mockRequest: AvailabilityRequest = {
    id: "avreq_mock_001",
    organizationId: "org_mock_001",
    weekStart: "2025-05-19",
    deadline: "2025-05-16T23:59:59.000Z",
    status: "OPEN",
    createdAt: "2025-05-10T09:00:00.000Z",
  }

  return { employee: mockEmployee, request: mockRequest }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { token } = await params

  const validated = await validateToken(token)
  if (!validated) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 })
  }

  return NextResponse.json({ data: validated })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  // Rate limit this public endpoint first — it is the most exposed surface.
  const { success } = await rateLimitRequest(getClientIp(req.headers))
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const { token } = await params

  const validated = await validateToken(token)
  if (!validated) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 })
  }

  // TODO: once DB is connected, this check will be backed by the real request status field.
  if (validated.request.status !== "OPEN") {
    return NextResponse.json({ error: "This availability request is no longer accepting submissions" }, { status: 409 })
  }

  const body = await req.json() as SubmitAvailabilityBody
  const { days } = body

  if (!Array.isArray(days) || days.length === 0) {
    return NextResponse.json({ error: "days array is required" }, { status: 400 })
  }

  // TODO: replace with DB write when DB is connected:
  // const requestId = (body as { requestId?: string }).requestId
  // const submission = await db.availabilitySubmission.upsert({
  //   where: { requestId_employeeId: { requestId: requestId!, employeeId: validated.employee.id } },
  //   create: { requestId: requestId!, employeeId: validated.employee.id, organizationId: validated.employee.organizationId },
  //   update: { submittedAt: new Date() },
  // })
  // await db.availabilityDay.deleteMany({ where: { submissionId: submission.id } })
  // await db.availabilityDay.createMany({
  //   data: days.map((d) => ({
  //     submissionId: submission.id,
  //     date: new Date(d.date),
  //     isAvailable: d.isAvailable,
  //     preferredStart: d.preferredStart ?? null,
  //     preferredEnd: d.preferredEnd ?? null,
  //   })),
  // })

  return NextResponse.json({ data: { submitted: true } }, { status: 201 })
}
