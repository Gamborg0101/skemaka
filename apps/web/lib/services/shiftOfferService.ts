import { db } from "@/lib/prisma"
import { resolveRecipientLocale, recipientLocaleTag } from "@/lib/messages"
import { getMondayOfWeek } from "@/lib/dateUtils"
import { isValidDate, isValidTime, timesAreDifferent, isNonNegativeInt } from "@/lib/validate"
import { getOrCreateSchedule } from "@/lib/services/scheduleService"
import { sendShiftOfferEmail, sendShiftOfferResultEmail } from "@/lib/resend"
import { sendShiftOfferedSms, sendShiftOfferResultSms } from "@/lib/sms"
import { sendPushToUsers } from "@/lib/push"
import { getMessageTranslator } from "@/lib/messages"
import type { Locale } from "@skemaka/i18n"
import type { ShiftOffer, EmployeeShiftOffer } from "@/types"
import { ServiceError } from "./errors"

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateShiftOfferInput = {
  date: string
  startTime: string
  endTime: string
  jobRole: string
  breakMinutes?: number
  note?: string | null
  deadline: string // ISO timestamp (end-of-day the manager chose)
  employeeIds: string[]
}

// Rows we notify: everything a channel might need, fetched once.
type NotifyEmployee = {
  id: string
  name: string
  email: string
  phone: string | null
  smsConsentAt: Date | null
  locale: string | null
  userId: string | null
}

type OfferRow = {
  id: string
  organizationId: string
  date: Date
  startTime: string
  endTime: string
  jobRole: string
  breakMinutes: number
  note: string | null
  deadline: Date
  status: string
  filledEmployeeId: string | null
  createdAt: Date
  updatedAt: Date
  resolvedAt: Date | null
  recipients: {
    id: string
    employeeId: string
    response: string
    respondedAt: Date | null
    employee: { name: string }
  }[]
}

const OFFER_INCLUDE = {
  recipients: {
    include: { employee: { select: { name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} as const

function serOffer(r: OfferRow): ShiftOffer {
  return {
    id: r.id,
    organizationId: r.organizationId,
    date: r.date.toISOString().slice(0, 10),
    startTime: r.startTime,
    endTime: r.endTime,
    jobRole: r.jobRole,
    breakMinutes: r.breakMinutes,
    note: r.note,
    deadline: r.deadline.toISOString(),
    status: r.status as ShiftOffer["status"],
    filledEmployeeId: r.filledEmployeeId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    recipients: r.recipients.map((rec) => ({
      id: rec.id,
      employeeId: rec.employeeId,
      employeeName: rec.employee.name,
      response: rec.response as ShiftOffer["recipients"][number]["response"],
      respondedAt: rec.respondedAt?.toISOString() ?? null,
    })),
  }
}

/** Resolve the caller's active employee record in this org, or throw. */
async function requireEmployee(orgId: string, userId: string): Promise<{ id: string; name: string }> {
  const emp = await db.employee.findFirst({
    where: { organizationId: orgId, userId, isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  })
  if (!emp) throw new ServiceError("You don't have an employee profile in this workspace", "FORBIDDEN")
  return emp
}

/** Fire-and-forget notify — a delivery failure must never fail the operation. */
function notify(p: Promise<unknown>): void {
  p.catch((err) => console.error("[shiftOffer] notify failed:", err))
}

function dayLabel(dateISO: string, locale: Locale, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(dateISO + "T12:00:00Z").toLocaleDateString(recipientLocaleTag(locale), {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC", ...opts,
  })
}

// ── Create (manager offers a slot to hand-picked staff) ───────────────────────

export async function createShiftOffer(
  orgId: string,
  userId: string,
  input: CreateShiftOfferInput,
): Promise<ShiftOffer> {
  const { date, startTime, endTime, jobRole } = input
  const breakMinutes = input.breakMinutes ?? 0
  const note = input.note?.trim() || null

  if (!isValidDate(date)) throw new ServiceError("date must be a valid YYYY-MM-DD date", "BAD_REQUEST")
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    throw new ServiceError("startTime and endTime must be valid HH:MM times", "BAD_REQUEST")
  }
  if (!timesAreDifferent(startTime, endTime)) {
    throw new ServiceError("startTime and endTime must differ", "BAD_REQUEST")
  }
  if (!jobRole || typeof jobRole !== "string") {
    throw new ServiceError("jobRole is required", "BAD_REQUEST")
  }
  if (!isNonNegativeInt(breakMinutes)) {
    throw new ServiceError("breakMinutes must be a non-negative integer", "BAD_REQUEST")
  }
  const deadlineDate = new Date(input.deadline)
  if (isNaN(deadlineDate.getTime())) throw new ServiceError("deadline must be a valid date", "BAD_REQUEST")
  if (deadlineDate.getTime() <= Date.now()) throw new ServiceError("deadline must be in the future", "BAD_REQUEST")

  const employeeIds = [...new Set(input.employeeIds)]
  if (employeeIds.length === 0) throw new ServiceError("Select at least one employee", "BAD_REQUEST")

  // Every recipient must be an active employee in this org.
  const valid = await db.employee.findMany({
    where: { id: { in: employeeIds }, organizationId: orgId, isActive: true },
    select: { id: true },
  })
  if (valid.length !== employeeIds.length) {
    throw new ServiceError("One or more selected employees are not valid", "BAD_REQUEST")
  }

  const created = await db.shiftOffer.create({
    data: {
      organizationId: orgId,
      date: new Date(date + "T00:00:00Z"),
      startTime,
      endTime,
      jobRole,
      breakMinutes,
      note,
      deadline: deadlineDate,
      createdByUserId: userId,
      recipients: { create: employeeIds.map((employeeId) => ({ employeeId })) },
    },
    include: OFFER_INCLUDE,
  })

  // Notify each recipient (push + email + SMS), fire-and-forget.
  const [org, employees] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId }, select: { name: true, locale: true } }),
    db.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, email: true, phone: true, smsConsentAt: true, locale: true, userId: true },
    }),
  ])
  const orgName = org?.name ?? ""
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const dateISO = created.date.toISOString().slice(0, 10)

  for (const emp of employees) {
    notifyOfferSent(emp, {
      orgName, orgLocale: org?.locale, dateISO,
      startTime, endTime, jobRole,
      deadline: deadlineDate, portalUrl: `${appUrl}/portal`,
    })
  }

  return serOffer(created as unknown as OfferRow)
}

function notifyOfferSent(
  emp: NotifyEmployee,
  ctx: {
    orgName: string; orgLocale: string | null | undefined; dateISO: string
    startTime: string; endTime: string; jobRole: string
    deadline: Date; portalUrl: string
  },
): void {
  const locale = resolveRecipientLocale(emp.locale, ctx.orgLocale)
  const firstName = emp.name.split(" ")[0]

  if (emp.email) {
    notify(sendShiftOfferEmail({
      to: emp.email, name: firstName, orgName: ctx.orgName,
      dateLabel: dayLabel(ctx.dateISO, locale),
      startTime: ctx.startTime, endTime: ctx.endTime, jobRole: ctx.jobRole,
      deadlineLabel: ctx.deadline.toLocaleDateString(recipientLocaleTag(locale), {
        weekday: "long", day: "numeric", month: "long",
      }),
      portalUrl: ctx.portalUrl, locale,
    }))
  }
  if (emp.phone && emp.smsConsentAt) {
    notify(sendShiftOfferedSms({
      to: emp.phone, name: firstName, orgName: ctx.orgName,
      date: ctx.dateISO, startTime: ctx.startTime, endTime: ctx.endTime,
      jobRole: ctx.jobRole, locale,
    }))
  }
  if (emp.userId) {
    const t = getMessageTranslator(locale, "sms")
    notify(sendPushToUsers([emp.userId], {
      title: t("push.shiftOfferedTitle"),
      body: t("push.shiftOfferedBody", { orgName: ctx.orgName, when: dayLabel(ctx.dateISO, locale, { weekday: "short", month: "short" }) }),
      url: "/portal",
    }))
  }
}

// ── Respond (recipient accepts / declines) ────────────────────────────────────

export async function respondToOffer(
  orgId: string,
  userId: string,
  offerId: string,
  response: "ACCEPTED" | "DECLINED",
): Promise<EmployeeShiftOffer> {
  const employee = await requireEmployee(orgId, userId)

  const offer = await db.shiftOffer.findFirst({
    where: { id: offerId, organizationId: orgId },
    include: OFFER_INCLUDE,
  })
  if (!offer) throw new ServiceError("Shift offer not found", "NOT_FOUND")
  if (offer.status !== "OPEN") throw new ServiceError("This offer is no longer open", "CONFLICT")
  if (offer.deadline.getTime() <= Date.now()) throw new ServiceError("The deadline for this offer has passed", "CONFLICT")

  const mine = offer.recipients.find((r) => r.employeeId === employee.id)
  if (!mine) throw new ServiceError("This offer wasn't sent to you", "FORBIDDEN")

  await db.shiftOfferRecipient.update({
    where: { id: mine.id },
    data: { response, respondedAt: new Date() },
  })

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true } })
  return serEmployeeOfferFromRow(
    { ...(offer as unknown as OfferRow) },
    employee.id,
    org?.name ?? "",
    response,
  )
}

// ── Confirm (manager picks the winner → creates & assigns the shift) ──────────

export async function confirmOffer(
  orgId: string,
  managerUserId: string,
  offerId: string,
  employeeId: string,
): Promise<ShiftOffer> {
  const offer = await db.shiftOffer.findFirst({
    where: { id: offerId, organizationId: orgId },
    include: OFFER_INCLUDE,
  })
  if (!offer) throw new ServiceError("Shift offer not found", "NOT_FOUND")
  if (offer.status !== "OPEN") throw new ServiceError("This offer is already resolved", "CONFLICT")

  const winner = offer.recipients.find((r) => r.employeeId === employeeId)
  if (!winner) throw new ServiceError("That employee wasn't offered this shift", "BAD_REQUEST")
  if (winner.response !== "ACCEPTED") throw new ServiceError("You can only confirm someone who accepted", "CONFLICT")

  const dateISO = offer.date.toISOString().slice(0, 10)
  const weekStart = getMondayOfWeek(new Date(dateISO + "T12:00:00"))
  const { schedule } = await getOrCreateSchedule(orgId, weekStart)

  const updated = await db.$transaction(async (tx) => {
    // Claim the offer first, guarded on status — if a concurrent confirm already
    // filled it, this matches 0 rows and we bail instead of creating a second shift.
    const claimed = await tx.shiftOffer.updateMany({
      where: { id: offerId, status: "OPEN" },
      data: {
        status: "FILLED",
        filledEmployeeId: employeeId,
        resolvedByUserId: managerUserId,
        resolvedAt: new Date(),
      },
    })
    if (claimed.count === 0) throw new ServiceError("This offer is already resolved", "CONFLICT")

    const shift = await tx.shift.create({
      data: {
        scheduleId: schedule.id,
        organizationId: orgId,
        employeeId,
        date: offer.date,
        startTime: offer.startTime,
        endTime: offer.endTime,
        breakMinutes: offer.breakMinutes,
        jobRole: offer.jobRole,
        notes: offer.note,
        // Born published: the winner is notified explicitly right below, so
        // this shift must never wait for (or re-announce at) the next roll-out.
        publishedAt: new Date(),
      },
    })
    return tx.shiftOffer.update({
      where: { id: offerId },
      data: { filledShiftId: shift.id },
      include: OFFER_INCLUDE,
    })
  })

  // Notify: winner "you got it", other accepters "filled".
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true, locale: true } })
  const notifyIds = offer.recipients
    .filter((r) => r.response === "ACCEPTED")
    .map((r) => r.employeeId)
  const employees = await db.employee.findMany({
    where: { id: { in: notifyIds } },
    select: { id: true, name: true, email: true, phone: true, smsConsentAt: true, locale: true, userId: true },
  })
  for (const emp of employees) {
    notifyOfferResult(emp, emp.id === employeeId, {
      orgName: org?.name ?? "", orgLocale: org?.locale, dateISO,
      startTime: offer.startTime, endTime: offer.endTime, jobRole: offer.jobRole,
    })
  }

  return serOffer(updated as unknown as OfferRow)
}

function notifyOfferResult(
  emp: NotifyEmployee,
  won: boolean,
  ctx: {
    orgName: string; orgLocale: string | null | undefined; dateISO: string
    startTime: string; endTime: string; jobRole: string
  },
): void {
  const locale = resolveRecipientLocale(emp.locale, ctx.orgLocale)
  const firstName = emp.name.split(" ")[0]

  if (emp.email) {
    notify(sendShiftOfferResultEmail({
      to: emp.email, name: firstName, orgName: ctx.orgName,
      dateLabel: dayLabel(ctx.dateISO, locale),
      startTime: ctx.startTime, endTime: ctx.endTime, jobRole: ctx.jobRole,
      won, locale,
    }))
  }
  if (emp.phone && emp.smsConsentAt) {
    notify(sendShiftOfferResultSms({
      to: emp.phone, name: firstName, orgName: ctx.orgName,
      date: ctx.dateISO, startTime: ctx.startTime, endTime: ctx.endTime, won, locale,
    }))
  }
  if (emp.userId) {
    const t = getMessageTranslator(locale, "sms")
    const when = dayLabel(ctx.dateISO, locale, { weekday: "short", month: "short" })
    notify(sendPushToUsers([emp.userId], {
      title: won ? t("push.shiftOfferWonTitle") : t("push.shiftOfferFilledTitle"),
      body: won
        ? t("push.shiftOfferWonBody", { orgName: ctx.orgName, when })
        : t("push.shiftOfferFilledBody", { orgName: ctx.orgName, when }),
      url: "/portal",
    }))
  }
}

// ── Cancel (manager withdraws the offer) ──────────────────────────────────────

export async function cancelOffer(
  orgId: string,
  offerId: string,
): Promise<ShiftOffer> {
  const offer = await db.shiftOffer.findFirst({
    where: { id: offerId, organizationId: orgId },
    select: { id: true, status: true },
  })
  if (!offer) throw new ServiceError("Shift offer not found", "NOT_FOUND")
  if (offer.status !== "OPEN") throw new ServiceError("This offer is already resolved", "CONFLICT")

  // Guarded on status, exactly like confirmOffer above. confirmOffer creates a
  // real Shift once it wins the swap; an unguarded cancel could then overwrite
  // FILLED with CANCELLED after the fact, leaving a scheduled shift behind an
  // offer that claims nobody took it.
  const swap = await db.shiftOffer.updateMany({
    where: { id: offerId, organizationId: orgId, status: "OPEN" },
    data: { status: "CANCELLED", resolvedAt: new Date() },
  })
  if (swap.count === 0) {
    throw new ServiceError("This offer is already resolved", "CONFLICT")
  }

  const updated = await db.shiftOffer.findUniqueOrThrow({
    where: { id: offerId },
    include: OFFER_INCLUDE,
  })
  return serOffer(updated as unknown as OfferRow)
}

// ── Lists ─────────────────────────────────────────────────────────────────────

/** Manager view: open offers with recipients + responses, newest first. */
export async function listForManager(orgId: string): Promise<ShiftOffer[]> {
  const rows = await db.shiftOffer.findMany({
    where: { organizationId: orgId, status: "OPEN" },
    include: OFFER_INCLUDE,
    orderBy: { createdAt: "desc" },
  })
  return rows.map((r) => serOffer(r as unknown as OfferRow))
}

/** Employee view: offers addressed to the caller that are still open. */
export async function listForEmployee(orgId: string, userId: string): Promise<EmployeeShiftOffer[]> {
  const employee = await requireEmployee(orgId, userId)
  const now = new Date()

  const rows = await db.shiftOffer.findMany({
    where: {
      organizationId: orgId,
      status: "OPEN",
      deadline: { gt: now },
      recipients: { some: { employeeId: employee.id } },
    },
    include: OFFER_INCLUDE,
    orderBy: { date: "asc" },
  })

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true } })
  const orgName = org?.name ?? ""

  return rows.map((r) => {
    const row = r as unknown as OfferRow
    const mine = row.recipients.find((rec) => rec.employeeId === employee.id)
    return serEmployeeOfferFromRow(row, employee.id, orgName, (mine?.response ?? "PENDING") as EmployeeShiftOffer["myResponse"])
  })
}

function serEmployeeOfferFromRow(
  r: OfferRow,
  employeeId: string,
  orgName: string,
  myResponse: EmployeeShiftOffer["myResponse"],
): EmployeeShiftOffer {
  return {
    id: r.id,
    date: r.date.toISOString().slice(0, 10),
    startTime: r.startTime,
    endTime: r.endTime,
    jobRole: r.jobRole,
    breakMinutes: r.breakMinutes,
    note: r.note,
    deadline: r.deadline.toISOString(),
    status: r.status as EmployeeShiftOffer["status"],
    orgName,
    myResponse,
    wonByMe: r.status === "FILLED" && r.filledEmployeeId === employeeId,
  }
}
