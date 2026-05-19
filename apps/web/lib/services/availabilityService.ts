import { db } from "@/lib/prisma"
import { serAvailabilityRequest, serAvailabilitySubmission, serEmployee } from "@/lib/serialize"
import { sendAvailabilityInviteEmail } from "@/lib/resend"
import type { AvailabilityRequest, AvailabilitySubmission, Employee } from "@/types"
import type { PaginationParams, Paginated } from "@/lib/validate"
import { ServiceError } from "./errors"

export async function listAvailabilityRequests(orgId: string): Promise<AvailabilityRequest[]>
export async function listAvailabilityRequests(orgId: string, pagination: PaginationParams): Promise<Paginated<AvailabilityRequest>>
export async function listAvailabilityRequests(
  orgId: string,
  pagination?: PaginationParams,
): Promise<AvailabilityRequest[] | Paginated<AvailabilityRequest>> {
  if (!pagination) {
    const requests = await db.availabilityRequest.findMany({
      where: { organizationId: orgId },
      orderBy: { weekStart: "desc" },
    })
    return requests.map(serAvailabilityRequest)
  }
  const where = { organizationId: orgId }
  const [requests, total] = await Promise.all([
    db.availabilityRequest.findMany({
      where,
      orderBy: { weekStart: "desc" },
      take: pagination.limit,
      skip: pagination.offset,
    }),
    db.availabilityRequest.count({ where }),
  ])
  return {
    data: requests.map(serAvailabilityRequest),
    meta: { total, limit: pagination.limit, offset: pagination.offset },
  }
}

export async function createAvailabilityRequest(
  orgId: string,
  weekStart: string,
  deadline: string,
): Promise<AvailabilityRequest> {
  const request = await db.availabilityRequest.create({
    data: {
      organizationId: orgId,
      weekStart: new Date(weekStart),
      deadline:  new Date(deadline),
    },
  })

  const [org, employees] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    db.employee.findMany({
      where: { organizationId: orgId, isActive: true, inviteToken: { not: null } },
      select: { email: true, name: true, inviteToken: true },
    }),
  ])

  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const weekLabel   = new Date(weekStart).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  const deadlineLabel = new Date(deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })

  void Promise.allSettled(
    employees.map((emp) =>
      sendAvailabilityInviteEmail({
        to:              emp.email,
        name:            emp.name,
        orgName:         org?.name ?? "",
        availabilityUrl: `${appUrl}/availability/${emp.inviteToken}`,
        weekLabel,
        deadline:        deadlineLabel,
      }),
    ),
  )

  return serAvailabilityRequest(request)
}

export async function listSubmissions(orgId: string, requestId: string): Promise<AvailabilitySubmission[]>
export async function listSubmissions(orgId: string, requestId: string, pagination: PaginationParams): Promise<Paginated<AvailabilitySubmission>>
export async function listSubmissions(
  orgId: string,
  requestId: string,
  pagination?: PaginationParams,
): Promise<AvailabilitySubmission[] | Paginated<AvailabilitySubmission>> {
  const where = { requestId, organizationId: orgId }
  const include = {
    employee: { select: { id: true, name: true, jobRole: true } },
    days:     { orderBy: { date: "asc" } as const },
  }
  if (!pagination) {
    const submissions = await db.availabilitySubmission.findMany({
      where, include, orderBy: { submittedAt: "asc" },
    })
    return submissions.map(serAvailabilitySubmission)
  }
  const [submissions, total] = await Promise.all([
    db.availabilitySubmission.findMany({
      where, include, orderBy: { submittedAt: "asc" },
      take: pagination.limit,
      skip: pagination.offset,
    }),
    db.availabilitySubmission.count({ where }),
  ])
  return {
    data: submissions.map(serAvailabilitySubmission),
    meta: { total, limit: pagination.limit, offset: pagination.offset },
  }
}

export type TokenContext = {
  employeeId:     string
  organizationId: string
  requestId:      string
  employee:       Employee
  request:        AvailabilityRequest
  orgName:        string
}

export async function resolveInviteToken(token: string): Promise<TokenContext | null> {
  const employee = await db.employee.findFirst({
    where: { inviteToken: token, isActive: true },
    orderBy: { createdAt: "asc" },
  })
  if (!employee) return null

  const [request, org] = await Promise.all([
    db.availabilityRequest.findFirst({
      where: { organizationId: employee.organizationId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
    }),
    db.organization.findUnique({
      where: { id: employee.organizationId },
      select: { name: true },
    }),
  ])
  if (!request) return null

  return {
    employeeId:     employee.id,
    organizationId: employee.organizationId,
    requestId:      request.id,
    employee:       serEmployee(employee),
    request:        serAvailabilityRequest(request),
    orgName:        org?.name ?? "",
  }
}

export type AvailabilityDayInput = {
  date:           string
  isAvailable:    boolean
  preferredStart?: string | null
  preferredEnd?:   string | null
}

export async function submitAvailability(
  requestId:  string,
  employeeId: string,
  orgId:      string,
  days:       AvailabilityDayInput[],
): Promise<void> {
  const submission = await db.availabilitySubmission.upsert({
    where:  { requestId_employeeId: { requestId, employeeId } },
    create: { requestId, employeeId, organizationId: orgId },
    update: { submittedAt: new Date() },
  })

  await db.availabilityDay.deleteMany({ where: { submissionId: submission.id } })
  await db.availabilityDay.createMany({
    data: days.map((d) => ({
      submissionId:   submission.id,
      date:           new Date(d.date),
      isAvailable:    d.isAvailable,
      preferredStart: d.preferredStart ?? null,
      preferredEnd:   d.preferredEnd   ?? null,
    })),
  })
}

export async function getEmployeeIdForUser(
  orgId: string,
  userId: string,
): Promise<string | null> {
  const emp = await db.employee.findFirst({
    where: { organizationId: orgId, userId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })
  return emp?.id ?? null
}

export class AvailabilityTokenError extends ServiceError {
  constructor() {
    super("Invalid or expired token", "NOT_FOUND")
  }
}
