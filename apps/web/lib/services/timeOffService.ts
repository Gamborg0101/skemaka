import { db } from "@/lib/prisma"
import { serTimeOffRequest } from "@/lib/serialize"
import { sendTimeOffApprovedSms, sendTimeOffDeniedSms } from "@/lib/sms"
import { resolveRecipientLocale } from "@/lib/messages"
import type { TimeOffRequest } from "@/types"
import type { PaginationParams, Paginated } from "@/lib/validate"
import { ServiceError } from "./errors"

export type TimeOffFilter = {
  status?: "PENDING" | "APPROVED" | "DENIED" | null
  employeeId?: string | null
  weekStart?: string | null
}

function buildTimeOffWhere(orgId: string, filter: TimeOffFilter) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { organizationId: orgId }
  if (filter.status)     where.status     = filter.status
  if (filter.employeeId) where.employeeId = filter.employeeId
  if (filter.weekStart) {
    const start = new Date(filter.weekStart + "T00:00:00Z")
    const end   = new Date(start)
    end.setUTCDate(end.getUTCDate() + 6)
    where.startDate = { lte: end }
    where.endDate   = { gte: start }
  }
  return where
}

export async function listTimeOff(orgId: string, filter?: TimeOffFilter): Promise<TimeOffRequest[]>
export async function listTimeOff(orgId: string, filter: TimeOffFilter, pagination: PaginationParams): Promise<Paginated<TimeOffRequest>>
export async function listTimeOff(
  orgId: string,
  filter: TimeOffFilter = {},
  pagination?: PaginationParams,
): Promise<TimeOffRequest[] | Paginated<TimeOffRequest>> {
  const where = buildTimeOffWhere(orgId, filter)
  const include = { employee: { select: { id: true, name: true, jobRole: true } } }
  if (!pagination) {
    const requests = await db.timeOffRequest.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
    })
    return requests.map(serTimeOffRequest)
  }
  const [requests, total] = await Promise.all([
    db.timeOffRequest.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      take:  pagination.limit,
      skip:  pagination.offset,
    }),
    db.timeOffRequest.count({ where }),
  ])
  return {
    data: requests.map(serTimeOffRequest),
    meta: { total, limit: pagination.limit, offset: pagination.offset },
  }
}

export async function createTimeOff(
  orgId: string,
  employeeId: string,
  startDate: string,
  endDate: string,
  reason: string | null,
): Promise<TimeOffRequest> {
  const start = new Date(startDate + "T00:00:00Z")
  const end   = new Date(endDate   + "T00:00:00Z")

  if (end < start) throw new ServiceError("endDate must be on or after startDate", "BAD_REQUEST")

  const overlap = await db.timeOffRequest.findFirst({
    where: {
      employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: end },
      endDate:   { gte: start },
    },
    orderBy: { createdAt: "asc" },
  })
  if (overlap) throw new ServiceError("A pending or approved request already overlaps these dates", "CONFLICT")

  const request = await db.timeOffRequest.create({
    data: { organizationId: orgId, employeeId, startDate: start, endDate: end, reason },
    include: { employee: { select: { id: true, name: true, jobRole: true } } },
  })
  return serTimeOffRequest(request)
}

export async function reviewTimeOff(
  orgId: string,
  requestId: string,
  status: "APPROVED" | "DENIED",
  reviewNote?: string,
): Promise<TimeOffRequest> {
  const existing = await db.timeOffRequest.findFirst({
    where: { id: requestId, organizationId: orgId },
    include: {
      employee: { select: { name: true, phone: true, locale: true } },
      organization: { select: { locale: true } },
    },
    orderBy: { createdAt: "asc" },
  })
  if (!existing) throw new ServiceError("Not found", "NOT_FOUND")
  if (existing.status !== "PENDING") throw new ServiceError("Request is no longer pending", "CONFLICT")

  // Compare-and-swap on PENDING. The read above cannot enforce anything: two
  // managers reviewing the same request at once both passed it, both wrote, and
  // — because the SMS is sent per call — the employee received "your time off is
  // approved" AND "your time off is denied" for one request, with the database
  // keeping whichever write landed last.
  const swap = await db.timeOffRequest.updateMany({
    where: { id: requestId, organizationId: orgId, status: "PENDING" },
    data: { status, reviewNote: reviewNote ?? null },
  })
  if (swap.count === 0) {
    throw new ServiceError("Request is no longer pending", "CONFLICT")
  }

  const updated = await db.timeOffRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { employee: { select: { id: true, name: true, jobRole: true } } },
  })

  const { name, phone } = existing.employee
  const startDate = existing.startDate.toISOString().split("T")[0]
  const endDate   = existing.endDate.toISOString().split("T")[0]
  const firstName = name.split(" ")[0]
  const locale = resolveRecipientLocale(existing.employee.locale, existing.organization.locale)

  if (phone) {
    if (status === "APPROVED") {
      void sendTimeOffApprovedSms({ to: phone, employeeName: firstName, startDate, endDate, locale })
    } else {
      void sendTimeOffDeniedSms({ to: phone, employeeName: firstName, startDate, endDate, reviewNote, locale })
    }
  }

  return serTimeOffRequest(updated)
}

export async function deleteTimeOff(orgId: string, requestId: string): Promise<void> {
  const existing = await db.timeOffRequest.findFirst({
    where: { id: requestId, organizationId: orgId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })
  if (!existing) throw new ServiceError("Not found", "NOT_FOUND")
  await db.timeOffRequest.delete({ where: { id: requestId } })
}
