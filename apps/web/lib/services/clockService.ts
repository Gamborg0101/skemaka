import { db } from "@/lib/prisma"
import { serTimeEntry } from "@/lib/serialize"
import { recordAudit } from "@/lib/audit"
import type { TimeEntry } from "@/types"
import type { PaginationParams, Paginated } from "@/lib/validate"
import { ServiceError } from "./errors"

const ENTRY_EMPLOYEE_SELECT = {
  id: true, name: true, jobRole: true,
} as const

// ── Clock in ──────────────────────────────────────────────────────────────────

export async function clockIn(
  orgId: string,
  employeeId: string,
  shiftId?: string | null,
  note?: string | null,
): Promise<TimeEntry> {
  return db.$transaction(async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, organizationId: orgId, isActive: true },
      select: { id: true },
    })
    if (!employee) throw new ServiceError("Employee not found", "NOT_FOUND")

    // Prevent duplicate clock-ins — one open entry per employee at a time.
    const open = await tx.timeEntry.findFirst({
      where: { employeeId, organizationId: orgId, clockOut: null },
      orderBy: { clockIn: "desc" },
    })
    if (open) throw new ServiceError("Already clocked in", "CONFLICT")

    if (shiftId) {
      const shift = await tx.shift.findFirst({
        where: { id: shiftId, organizationId: orgId, employeeId },
        select: { id: true },
      })
      if (!shift) throw new ServiceError("Shift not found or does not belong to this employee", "NOT_FOUND")
    }

    const entry = await tx.timeEntry.create({
      data: {
        organizationId: orgId,
        employeeId,
        shiftId: shiftId ?? null,
        clockIn: new Date(), // server timestamp — never trust client time
        note: note ?? null,
      },
      include: { employee: { select: ENTRY_EMPLOYEE_SELECT } },
    })
    return serTimeEntry(entry)
  })
}

// ── Clock out ─────────────────────────────────────────────────────────────────

export async function clockOut(
  orgId: string,
  employeeId: string,
  breakMinutes?: number,
  note?: string | null,
): Promise<TimeEntry> {
  const open = await db.timeEntry.findFirst({
    where: { employeeId, organizationId: orgId, clockOut: null },
    orderBy: { clockIn: "desc" },
  })
  if (!open) throw new ServiceError("Not clocked in", "BAD_REQUEST")

  const entry = await db.timeEntry.update({
    where: { id: open.id },
    data: {
      clockOut: new Date(), // server timestamp — never trust client time
      ...(breakMinutes !== undefined && { breakMinutes }),
      ...(note          !== undefined && { note }),
    },
    include: { employee: { select: ENTRY_EMPLOYEE_SELECT } },
  })
  return serTimeEntry(entry)
}

// ── Active entry ──────────────────────────────────────────────────────────────

export async function getActiveEntry(
  orgId: string,
  employeeId: string,
): Promise<TimeEntry | null> {
  const entry = await db.timeEntry.findFirst({
    where: { employeeId, organizationId: orgId, clockOut: null },
    include: { employee: { select: ENTRY_EMPLOYEE_SELECT } },
    orderBy: { clockIn: "desc" },
  })
  return entry ? serTimeEntry(entry) : null
}

// ── List ──────────────────────────────────────────────────────────────────────

export type TimeEntryFilter = {
  employeeId?: string | null
  dateFrom?: string | null // YYYY-MM-DD
  dateTo?: string | null   // YYYY-MM-DD (inclusive)
  open?: boolean           // true = only open entries, false = only closed
}

function buildWhere(orgId: string, filter: TimeEntryFilter) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { organizationId: orgId }
  if (filter.employeeId) where.employeeId = filter.employeeId
  if (filter.open === true)  where.clockOut = null
  if (filter.open === false) where.NOT = { clockOut: null }
  if (filter.dateFrom || filter.dateTo) {
    const clockInFilter: Record<string, Date> = {}
    if (filter.dateFrom) clockInFilter.gte = new Date(filter.dateFrom + "T00:00:00Z")
    if (filter.dateTo)   clockInFilter.lte = new Date(filter.dateTo   + "T23:59:59Z")
    where.clockIn = clockInFilter
  }
  return where
}

export async function listTimeEntries(orgId: string, filter?: TimeEntryFilter): Promise<TimeEntry[]>
export async function listTimeEntries(orgId: string, filter: TimeEntryFilter, pagination: PaginationParams): Promise<Paginated<TimeEntry>>
export async function listTimeEntries(
  orgId: string,
  filter: TimeEntryFilter = {},
  pagination?: PaginationParams,
): Promise<TimeEntry[] | Paginated<TimeEntry>> {
  const where   = buildWhere(orgId, filter)
  const include = { employee: { select: ENTRY_EMPLOYEE_SELECT } }

  if (!pagination) {
    const entries = await db.timeEntry.findMany({ where, include, orderBy: { clockIn: "desc" } })
    return entries.map(serTimeEntry)
  }

  const [entries, total] = await Promise.all([
    db.timeEntry.findMany({
      where, include, orderBy: { clockIn: "desc" },
      take: pagination.limit, skip: pagination.offset,
    }),
    db.timeEntry.count({ where }),
  ])
  return {
    data: entries.map(serTimeEntry),
    meta: { total, limit: pagination.limit, offset: pagination.offset },
  }
}

// ── Manager corrections ───────────────────────────────────────────────────────

export type UpdateTimeEntryInput = Partial<{
  clockIn:      string        // ISO 8601 timestamp
  clockOut:     string | null // ISO 8601 timestamp or null to re-open entry
  breakMinutes: number
  shiftId:      string | null
  note:         string | null
}>

export async function adminUpdateEntry(
  orgId: string,
  entryId: string,
  input: UpdateTimeEntryInput,
  actorUserId: string,
): Promise<TimeEntry> {
  const existing = await db.timeEntry.findFirst({
    where: { id: entryId, organizationId: orgId },
    orderBy: { createdAt: "asc" },
  })
  if (!existing) throw new ServiceError("Not found", "NOT_FOUND")

  // Validate that clockOut is after clockIn (if either is being changed)
  const resolvedIn  = input.clockIn  ? new Date(input.clockIn)  : existing.clockIn
  const resolvedOut = input.clockOut !== undefined
    ? (input.clockOut ? new Date(input.clockOut) : null)
    : existing.clockOut

  if (resolvedOut && resolvedOut <= resolvedIn) {
    throw new ServiceError("clockOut must be after clockIn", "BAD_REQUEST")
  }

  const entry = await db.timeEntry.update({
    where: { id: entryId },
    data: {
      ...(input.clockIn      !== undefined && { clockIn:      new Date(input.clockIn) }),
      ...(input.clockOut     !== undefined && { clockOut:     input.clockOut ? new Date(input.clockOut) : null }),
      ...(input.breakMinutes !== undefined && { breakMinutes: input.breakMinutes }),
      ...(input.shiftId      !== undefined && { shiftId:      input.shiftId }),
      ...(input.note         !== undefined && { note:         input.note }),
    },
    include: { employee: { select: ENTRY_EMPLOYEE_SELECT } },
  })

  recordAudit({
    orgId,
    actorUserId,
    action: "TIME_ENTRY_UPDATED",
    entity: `TimeEntry:${entryId}`,
    before: { clockIn: existing.clockIn.toISOString(), clockOut: existing.clockOut?.toISOString() ?? null, breakMinutes: existing.breakMinutes },
    after:  { clockIn: entry.clockIn.toISOString(),    clockOut: entry.clockOut?.toISOString() ?? null,    breakMinutes: entry.breakMinutes },
  })

  return serTimeEntry(entry)
}

export async function adminDeleteEntry(orgId: string, entryId: string, actorUserId: string): Promise<void> {
  const existing = await db.timeEntry.findFirst({
    where: { id: entryId, organizationId: orgId },
    orderBy: { createdAt: "asc" },
  })
  if (!existing) throw new ServiceError("Not found", "NOT_FOUND")
  await db.timeEntry.delete({ where: { id: entryId } })

  recordAudit({
    orgId,
    actorUserId,
    action: "TIME_ENTRY_DELETED",
    entity: `TimeEntry:${entryId}`,
    before: { clockIn: existing.clockIn.toISOString(), clockOut: existing.clockOut?.toISOString() ?? null, breakMinutes: existing.breakMinutes },
  })
}
