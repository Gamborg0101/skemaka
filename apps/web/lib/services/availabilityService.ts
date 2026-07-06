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

function currentMondayISO(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff))
  return mon.toISOString().split("T")[0]
}

function offsetWeekISO(weekStart: string, n: number): string {
  const [y, m, d] = weekStart.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + n * 7))
  return date.toISOString().split("T")[0]
}

/**
 * Returns the existing availability request for the given week, or auto-creates one
 * if the week falls within the org's availability window (default 1 week).
 * Past weeks with existing requests are always returned (read-only). Returns null
 * for future weeks outside the window or past weeks with no request.
 */
export async function getOrCreateForWeek(
  orgId: string,
  weekStart: string,
): Promise<AvailabilityRequest | null> {
  // Always return an existing request regardless of when the week falls
  const existing = await db.availabilityRequest.findFirst({
    where: { organizationId: orgId, weekStart: new Date(weekStart) },
    orderBy: { createdAt: "asc" },
  })
  if (existing) return serAvailabilityRequest(existing)

  // For past weeks with no existing request, don't create one
  const today = currentMondayISO()
  if (weekStart < today) return null

  // Cap auto-creation at 8 weeks out so employees can submit well in advance
  // without creating requests arbitrarily far into the future.
  if (weekStart >= offsetWeekISO(today, 8)) return null

  // Auto-create — deadline = Friday before the week starts
  const [y, m, d] = weekStart.split("-").map(Number)
  const deadlineDate = new Date(Date.UTC(y, m - 1, d - 3))
  const deadline = deadlineDate.toISOString().split("T")[0]

  const created = await db.availabilityRequest.create({
    data: {
      organizationId: orgId,
      weekStart: new Date(weekStart),
      deadline:  new Date(deadline),
    },
  })
  return serAvailabilityRequest(created)
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

  // The availability link is keyed on Employee.inviteToken, which resolveInviteToken
  // requires to be unexpired. inviteExpiry is only set at invite time (+7 days), so
  // any request sent more than a week after an employee was invited would email a
  // dead link. Refresh the window (and mint a token for anyone missing one) so the
  // link is guaranteed valid for this cycle. Identity-claiming is separately gated
  // by an emailed 6-digit code, so a longer token window is not a hijack risk.
  const linkExpiry = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
  const active = await db.employee.findMany({
    where: { organizationId: orgId, isActive: true },
    select: { id: true, inviteToken: true },
  })
  await db.$transaction(
    active.map((emp) =>
      db.employee.update({
        where: { id: emp.id },
        data: {
          inviteToken:  emp.inviteToken ?? crypto.randomUUID(),
          inviteExpiry: linkExpiry,
        },
      }),
    ),
  )

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
    where: { inviteToken: token, isActive: true, inviteExpiry: { gt: new Date() } },
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
  date:        string
  isAvailable: boolean
  startTime?:  string | null
  endTime?:    string | null
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
      submissionId: submission.id,
      date:         new Date(d.date),
      isAvailable:  d.isAvailable,
      startTime:    d.isAvailable ? (d.startTime ?? null) : null,
      endTime:      d.isAvailable ? (d.endTime   ?? null) : null,
    })),
  })
}

/**
 * Read-only: the (employeeId, date) pairs an employee marked *unavailable* for a
 * given week, so the scheduler can flag conflicts when assigning shifts. Unlike
 * getOrCreateForWeek this never creates a request — it just reads what's there,
 * returning [] when no availability was collected for the week.
 */
export async function getWeekUnavailability(
  orgId: string,
  weekStart: string,
): Promise<{ employeeId: string; date: string }[]> {
  const request = await db.availabilityRequest.findFirst({
    where: { organizationId: orgId, weekStart: new Date(weekStart) },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })
  if (!request) return []

  const submissions = await db.availabilitySubmission.findMany({
    where: { requestId: request.id, organizationId: orgId },
    select: {
      employeeId: true,
      days: { where: { isAvailable: false }, select: { date: true } },
    },
  })

  const out: { employeeId: string; date: string }[] = []
  for (const s of submissions) {
    for (const d of s.days) {
      out.push({ employeeId: s.employeeId, date: d.date.toISOString().slice(0, 10) })
    }
  }
  return out
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
