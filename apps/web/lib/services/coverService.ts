import { db } from "@/lib/prisma"
import { PrismaClient, $Enums } from "@/app/generated/prisma/client"
import { resolveRecipientLocale } from "@/lib/messages"
import { ServiceError } from "./errors"
import {
  sendCoverOfferedSms,
  sendCoverClaimedSms,
  sendCoverApprovedSms,
  sendCoverDeniedSms,
} from "@/lib/sms"
import type { CoverRequest } from "@/types"

// Requests that are still "live" — only one may exist per shift at a time.
const ACTIVE_STATUSES: $Enums.CoverRequestStatus[] = ["OPEN", "CLAIMED"]

type CoverRow = {
  id: string
  organizationId: string
  shiftId: string
  requesterEmployeeId: string
  claimedByEmployeeId: string | null
  status: string
  note: string | null
  createdAt: Date
  updatedAt: Date
  resolvedAt: Date | null
  requester: { name: string }
  claimedBy: { name: string } | null
  shift: {
    id: string
    date: Date
    startTime: string
    endTime: string
    jobRole: string
    colorTag: string | null
  }
}

const COVER_INCLUDE = {
  requester: { select: { name: true } },
  claimedBy: { select: { name: true } },
  shift: { select: { id: true, date: true, startTime: true, endTime: true, jobRole: true, colorTag: true } },
} as const

function serCover(r: CoverRow): CoverRequest {
  return {
    id: r.id,
    organizationId: r.organizationId,
    shiftId: r.shiftId,
    requesterEmployeeId: r.requesterEmployeeId,
    requesterName: r.requester.name,
    claimedByEmployeeId: r.claimedByEmployeeId,
    claimedByName: r.claimedBy?.name ?? null,
    status: r.status as CoverRequest["status"],
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    shift: {
      id: r.shift.id,
      date: r.shift.date.toISOString().slice(0, 10),
      startTime: r.shift.startTime,
      endTime: r.shift.endTime,
      jobRole: r.shift.jobRole,
      colorTag: r.shift.colorTag,
    },
  }
}

/** Resolve the caller's active employee record in this org, or throw. */
async function requireEmployee(orgId: string, userId: string): Promise<{ id: string; name: string }> {
  const emp = await db.employee.findFirst({
    where: { organizationId: orgId, userId, isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  })
  if (!emp) {
    throw new ServiceError("You don't have an employee profile in this workspace", "FORBIDDEN", {
      messageKey: "noEmployeeProfile",
    })
  }
  return emp
}

/** Fire-and-forget SMS — a delivery failure must never fail the operation. */
function notify(p: Promise<void>): void {
  p.catch((err) => console.error("[cover] SMS notify failed:", err))
}

// ── Create (employee offers up their shift) ───────────────────────────────────

export async function createCoverRequest(
  orgId: string,
  userId: string,
  shiftId: string,
  note: string | null,
): Promise<CoverRequest> {
  const employee = await requireEmployee(orgId, userId)

  const shift = await db.shift.findFirst({
    where: { id: shiftId, organizationId: orgId },
    select: { id: true, employeeId: true, date: true, startTime: true, endTime: true, jobRole: true, cancelledAt: true },
  })
  if (!shift) throw new ServiceError("Shift not found", "NOT_FOUND")
  if (shift.cancelledAt) throw new ServiceError("This shift has been cancelled", "CONFLICT")
  if (shift.employeeId !== employee.id) {
    throw new ServiceError("You can only offer up your own shifts", "FORBIDDEN")
  }

  // Check-then-act, so it has to be serialised: without the lock two offers that
  // interleave between the read and the insert both see nothing and both create
  // a request. A double-tap on "I'll cover it" is enough, and the result is two
  // OPEN requests for one shift — two teammates can each claim it, and the
  // manager gets two approvals for a single slot.
  //
  // The lock is taken on the SHIFT row rather than on the cover requests,
  // because the row being contended is the shift: the thing there can only be
  // one active offer for. Locking a row that does not exist yet is not possible,
  // which is exactly why the naive version had nothing to serialise on.
  //
  // Same pattern as assertSeatAvailable in lib/services/seats.ts. The insert
  // must stay inside this transaction — if it lands after commit the lock is
  // already released and the race reopens.
  const created = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Shift" WHERE "id" = ${shiftId} FOR UPDATE`

    const existing = await tx.shiftCoverRequest.findFirst({
      where: { shiftId, status: { in: ACTIVE_STATUSES } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
    if (existing) throw new ServiceError("This shift is already up for cover", "CONFLICT")

    return tx.shiftCoverRequest.create({
      data: {
        organizationId: orgId,
        shiftId,
        requesterEmployeeId: employee.id,
        status: "OPEN",
        note: note?.trim() || null,
      },
      include: COVER_INCLUDE,
    })
  })

  // Notify eligible teammates: active, same job role, not the requester, opted in.
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true, locale: true } })
  const teammates = await db.employee.findMany({
    where: {
      organizationId: orgId,
      isActive: true,
      jobRole: shift.jobRole,
      id: { not: employee.id },
      phone: { not: null },
      smsConsentAt: { not: null },
    },
    select: { name: true, phone: true, locale: true },
  })
  const date = shift.date.toISOString().slice(0, 10)
  for (const t of teammates) {
    notify(
      sendCoverOfferedSms({
        to: t.phone!,
        employeeName: t.name,
        orgName: org?.name ?? "",
        date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        jobRole: shift.jobRole,
        locale: resolveRecipientLocale(t.locale, org?.locale),
      }),
    )
  }

  return serCover(created as unknown as CoverRow)
}

// ── Claim (teammate offers to cover) ──────────────────────────────────────────

export async function claimCoverRequest(
  orgId: string,
  userId: string,
  requestId: string,
): Promise<CoverRequest> {
  const claimer = await requireEmployee(orgId, userId)

  const req = await db.shiftCoverRequest.findFirst({
    where: { id: requestId, organizationId: orgId },
    include: COVER_INCLUDE,
  })
  if (!req) throw new ServiceError("Cover request not found", "NOT_FOUND")
  if (req.status !== "OPEN") throw new ServiceError("This shift is no longer open to claim", "CONFLICT")
  if (req.requesterEmployeeId === claimer.id) {
    throw new ServiceError("You can't claim your own shift", "CONFLICT")
  }

  // Compare-and-swap: `status: "OPEN"` in the WHERE is what makes this safe.
  // The check above is a courtesy that produces a good error message — it cannot
  // enforce anything, because another claimer can take the shift between that
  // read and this write. Postgres evaluates one UPDATE atomically, so exactly
  // one of N simultaneous claims matches a row and the rest report 0.
  //
  // Without it, three teammates tapping "I'll cover it" together all succeeded,
  // each overwriting the last, and each was told they got the shift.
  const swap = await db.shiftCoverRequest.updateMany({
    where: { id: requestId, organizationId: orgId, status: "OPEN" },
    data: { status: "CLAIMED", claimedByEmployeeId: claimer.id },
  })
  if (swap.count === 0) {
    throw new ServiceError("This shift is no longer open to claim", "CONFLICT")
  }

  const updated = await db.shiftCoverRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: COVER_INCLUDE,
  })

  // Tell the requester someone stepped up (pending manager approval).
  const [org, requester] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId }, select: { name: true, locale: true } }),
    db.employee.findUnique({ where: { id: req.requesterEmployeeId }, select: { name: true, phone: true, smsConsentAt: true, locale: true } }),
  ])
  if (requester?.phone && requester.smsConsentAt) {
    notify(
      sendCoverClaimedSms({
        to: requester.phone,
        requesterName: requester.name,
        claimerName: claimer.name,
        orgName: org?.name ?? "",
        date: req.shift.date.toISOString().slice(0, 10),
        startTime: req.shift.startTime,
        endTime: req.shift.endTime,
        locale: resolveRecipientLocale(requester.locale, org?.locale),
      }),
    )
  }

  return serCover(updated as unknown as CoverRow)
}

// ── Approve (manager) — reassign the shift to the claimer ─────────────────────

export async function approveCoverRequest(
  orgId: string,
  managerUserId: string,
  requestId: string,
): Promise<CoverRequest> {
  const req = await db.shiftCoverRequest.findFirst({
    where: { id: requestId, organizationId: orgId },
    include: COVER_INCLUDE,
  })
  if (!req) throw new ServiceError("Cover request not found", "NOT_FOUND")
  if (req.status !== "CLAIMED" || !req.claimedByEmployeeId) {
    throw new ServiceError("Only a claimed request can be approved", "CONFLICT")
  }

  const claimedById = req.claimedByEmployeeId
  const updated = await db.$transaction(async (tx) => {
    const client = tx as unknown as PrismaClient

    // Swap first, reassign second, both inside the transaction. Approving is the
    // only step that moves a shift between people, so it must happen if and only
    // if this call is the one that resolved the request. A concurrent deny that
    // won the write would otherwise leave the roster reassigned while the record
    // says DENIED — the shift changes hands with nothing to show for it.
    const swap = await client.shiftCoverRequest.updateMany({
      where: { id: requestId, organizationId: orgId, status: "CLAIMED" },
      data: { status: "APPROVED", resolvedAt: new Date(), resolvedByUserId: managerUserId },
    })
    if (swap.count === 0) {
      throw new ServiceError("This request has already been resolved", "CONFLICT", {
        messageKey: "requestAlreadyResolved",
      })
    }

    await client.shift.update({ where: { id: req.shiftId }, data: { employeeId: claimedById } })

    return client.shiftCoverRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: COVER_INCLUDE,
    })
  })

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true, locale: true } })
  const [requester, claimer] = await Promise.all([
    db.employee.findUnique({ where: { id: req.requesterEmployeeId }, select: { name: true, phone: true, smsConsentAt: true, locale: true } }),
    db.employee.findUnique({ where: { id: claimedById }, select: { name: true, phone: true, smsConsentAt: true, locale: true } }),
  ])
  const date = req.shift.date.toISOString().slice(0, 10)
  if (requester?.phone && requester.smsConsentAt) {
    notify(sendCoverApprovedSms({ to: requester.phone, name: requester.name, orgName: org?.name ?? "", date, startTime: req.shift.startTime, endTime: req.shift.endTime, role: "requester", locale: resolveRecipientLocale(requester.locale, org?.locale) }))
  }
  if (claimer?.phone && claimer.smsConsentAt) {
    notify(sendCoverApprovedSms({ to: claimer.phone, name: claimer.name, orgName: org?.name ?? "", date, startTime: req.shift.startTime, endTime: req.shift.endTime, role: "claimer", locale: resolveRecipientLocale(claimer.locale, org?.locale) }))
  }

  return serCover(updated as unknown as CoverRow)
}

// ── Deny (manager) ────────────────────────────────────────────────────────────

export async function denyCoverRequest(
  orgId: string,
  managerUserId: string,
  requestId: string,
): Promise<CoverRequest> {
  const req = await db.shiftCoverRequest.findFirst({
    where: { id: requestId, organizationId: orgId },
    include: COVER_INCLUDE,
  })
  if (!req) throw new ServiceError("Cover request not found", "NOT_FOUND")
  if (req.status !== "OPEN" && req.status !== "CLAIMED") {
    throw new ServiceError("This request is already resolved", "CONFLICT", {
      messageKey: "requestAlreadyResolved",
    })
  }

  // Same compare-and-swap as approve, so the two cannot both win. Denying does
  // not touch the roster, so losing this race is harmless — the request is
  // simply already resolved.
  const swap = await db.shiftCoverRequest.updateMany({
    where: { id: requestId, organizationId: orgId, status: { in: ACTIVE_STATUSES } },
    data: { status: "DENIED", resolvedAt: new Date(), resolvedByUserId: managerUserId },
  })
  if (swap.count === 0) {
    throw new ServiceError("This request is already resolved", "CONFLICT", {
      messageKey: "requestAlreadyResolved",
    })
  }

  const updated = await db.shiftCoverRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: COVER_INCLUDE,
  })

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true, locale: true } })
  const date = req.shift.date.toISOString().slice(0, 10)
  const recipients = [req.requesterEmployeeId, req.claimedByEmployeeId].filter(Boolean) as string[]
  for (const empId of recipients) {
    const emp = await db.employee.findUnique({ where: { id: empId }, select: { name: true, phone: true, smsConsentAt: true, locale: true } })
    if (emp?.phone && emp.smsConsentAt) {
      notify(sendCoverDeniedSms({ to: emp.phone, name: emp.name, orgName: org?.name ?? "", date, startTime: req.shift.startTime, endTime: req.shift.endTime, locale: resolveRecipientLocale(emp.locale, org?.locale) }))
    }
  }

  return serCover(updated as unknown as CoverRow)
}

// ── Cancel (requester withdraws their own request) ────────────────────────────

export async function cancelCoverRequest(
  orgId: string,
  userId: string,
  requestId: string,
): Promise<CoverRequest> {
  const employee = await requireEmployee(orgId, userId)
  const req = await db.shiftCoverRequest.findFirst({
    where: { id: requestId, organizationId: orgId },
    select: { id: true, requesterEmployeeId: true, status: true },
  })
  if (!req) throw new ServiceError("Cover request not found", "NOT_FOUND")
  if (req.requesterEmployeeId !== employee.id) {
    throw new ServiceError("You can only cancel your own cover requests", "FORBIDDEN")
  }
  if (req.status !== "OPEN" && req.status !== "CLAIMED") {
    throw new ServiceError("This request is already resolved", "CONFLICT", {
      messageKey: "requestAlreadyResolved",
    })
  }

  // Guarded like the other transitions. A requester withdrawing at the same
  // moment a manager approves must not undo the approval — approve reassigns the
  // shift, so an unguarded cancel landing afterwards would mark the request
  // CANCELLED while the roster had already changed hands.
  const swap = await db.shiftCoverRequest.updateMany({
    where: { id: requestId, organizationId: orgId, status: { in: ACTIVE_STATUSES } },
    data: { status: "CANCELLED", resolvedAt: new Date() },
  })
  if (swap.count === 0) {
    throw new ServiceError("This request is already resolved", "CONFLICT", {
      messageKey: "requestAlreadyResolved",
    })
  }

  const updated = await db.shiftCoverRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: COVER_INCLUDE,
  })
  return serCover(updated as unknown as CoverRow)
}

// ── Lists ─────────────────────────────────────────────────────────────────────

/** Manager view: all pending (OPEN + CLAIMED) requests, newest first. */
export async function listPendingForManager(orgId: string): Promise<CoverRequest[]> {
  const rows = await db.shiftCoverRequest.findMany({
    where: { organizationId: orgId, status: { in: ACTIVE_STATUSES } },
    include: COVER_INCLUDE,
    orderBy: { createdAt: "desc" },
  })
  return rows.map((r) => serCover(r as unknown as CoverRow))
}

/**
 * Employee view: the open pool they could claim (OPEN, not their own, matching
 * job role) plus their own requests and anything they've claimed.
 */
export async function listForEmployee(orgId: string, userId: string): Promise<{
  pool: CoverRequest[]
  mine: CoverRequest[]
}> {
  const employee = await requireEmployee(orgId, userId)
  const empRole = await db.employee.findUnique({ where: { id: employee.id }, select: { jobRole: true } })

  const [poolRows, mineRows] = await Promise.all([
    db.shiftCoverRequest.findMany({
      where: {
        organizationId: orgId,
        status: "OPEN",
        requesterEmployeeId: { not: employee.id },
        // Only show shifts this employee could actually work (same role).
        shift: { jobRole: empRole?.jobRole },
      },
      include: COVER_INCLUDE,
      orderBy: { createdAt: "desc" },
    }),
    db.shiftCoverRequest.findMany({
      where: {
        organizationId: orgId,
        OR: [{ requesterEmployeeId: employee.id }, { claimedByEmployeeId: employee.id }],
      },
      include: COVER_INCLUDE,
      orderBy: { createdAt: "desc" },
    }),
  ])

  return {
    pool: poolRows.map((r) => serCover(r as unknown as CoverRow)),
    mine: mineRows.map((r) => serCover(r as unknown as CoverRow)),
  }
}
