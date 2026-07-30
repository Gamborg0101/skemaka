import { db } from "@/lib/prisma"
import { PrismaClient } from "@/app/generated/prisma/client"
import { serEmployee, serShift } from "@/lib/serialize"
import { isEmploymentType } from "@/types"
import type { Employee, Shift } from "@/types"
import type { PaginationParams } from "@/lib/validate"
import { sendInviteEmail } from "@/lib/resend"
import { resolveRecipientLocale } from "@/lib/messages"
import { recordAudit } from "@/lib/audit"
import { syncSubscriptionQuantitySafe } from "./billingService"
import { ServiceError } from "./errors"
import { assertSeatAvailable } from "./seats"

/** Optional filter for the paginated employee list. */
export type EmployeeListFilter = { isActive?: boolean }

/**
 * Paginated employee list. Meta carries `activeCount` / `inactiveCount` for the
 * whole org (independent of the current filter) so the UI can render tab badges
 * while paging within a single tab.
 */
export type PaginatedEmployees = {
  data: Employee[]
  meta: { total: number; limit: number; offset: number; activeCount: number; inactiveCount: number }
}

export async function listEmployees(orgId: string): Promise<Employee[]>
export async function listEmployees(
  orgId: string,
  pagination: PaginationParams,
  filter?: EmployeeListFilter,
): Promise<PaginatedEmployees>
export async function listEmployees(
  orgId: string,
  pagination?: PaginationParams,
  filter?: EmployeeListFilter,
): Promise<Employee[] | PaginatedEmployees> {
  if (!pagination) {
    const employees = await db.employee.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    })
    return employees.map(serEmployee)
  }
  const where = {
    organizationId: orgId,
    ...(filter?.isActive !== undefined ? { isActive: filter.isActive } : {}),
  }
  const [employees, total, activeCount, inactiveCount] = await Promise.all([
    db.employee.findMany({
      where,
      orderBy: { name: "asc" },
      take:  pagination.limit,
      skip:  pagination.offset,
    }),
    db.employee.count({ where }),
    db.employee.count({ where: { organizationId: orgId, isActive: true } }),
    db.employee.count({ where: { organizationId: orgId, isActive: false } }),
  ])
  return {
    data: employees.map(serEmployee),
    meta: { total, limit: pagination.limit, offset: pagination.offset, activeCount, inactiveCount },
  }
}

export type CreateEmployeeInput = {
  name:             string
  email:            string
  phone?:           string | null
  jobRole:          string
  hourlyWage:       number
  notes?:           string | null
  employmentType?:  string
  contractedHours?: number
}

async function assertValidJobRole(orgId: string, jobRole: string): Promise<void> {
  const role = await db.jobRole.findFirst({ where: { organizationId: orgId, name: jobRole }, select: { id: true } })
  if (!role) throw new ServiceError(`Job role "${jobRole}" does not exist in this organisation`, "BAD_REQUEST")
}

export async function createEmployee(orgId: string, input: CreateEmployeeInput): Promise<Employee> {
  await assertValidJobRole(orgId, input.jobRole)

  const email = input.email.toLowerCase().trim()

  const existing = await db.employee.findUnique({
    where: { organizationId_email: { organizationId: orgId, email } },
  })
  if (existing) throw new ServiceError("An employee with this email already exists", "CONFLICT")

  const resolvedType = input.employmentType && isEmploymentType(input.employmentType)
    ? input.employmentType
    : "PART_TIME"

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true, currency: true, locale: true } })

  // The seat check and the insert share one transaction: assertSeatAvailable
  // locks the org row, and releasing that lock before the employee exists would
  // let a concurrent add slip through on the same free seat.
  const employee = await db.$transaction(async (tx) => {
    await assertSeatAvailable(tx, orgId)
    return tx.employee.create({
      data: {
        organizationId:   orgId,
        name:             input.name,
        email:            email,
        phone:            input.phone           ?? null,
        // Record that the manager asserted SMS consent when a number is provided.
        smsConsentAt:     input.phone ? new Date() : null,
        jobRole:          input.jobRole,
        hourlyWage:       input.hourlyWage,
        wageBaseAmount:   input.hourlyWage,
        wageBaseCurrency: org?.currency ?? "EUR",
        employmentType:   resolvedType,
        contractedHours:  input.contractedHours ?? 0,
        notes:            input.notes           ?? null,
        inviteToken:      crypto.randomUUID(),
        inviteExpiry:     new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  sendInviteEmail({
    to:        employee.email,
    name:      employee.name,
    orgName:   org?.name ?? "",
    inviteUrl: `${appUrl}/portal`,
    joinUrl:   `${appUrl}/join/${employee.inviteToken}`,
    locale:    resolveRecipientLocale(org?.locale),
  }).catch((err) => console.error("[invite] Resend error:", err))

  syncSubscriptionQuantitySafe(orgId)

  return serEmployee(employee)
}

export type UpdateEmployeeInput = Partial<{
  name:            string
  email:           string
  phone:           string | null
  jobRole:         string
  hourlyWage:      number
  notes:           string | null
  isActive:        boolean
  employmentType:  string
  contractedHours: number
}>

export async function updateEmployee(
  orgId:      string,
  employeeId: string,
  input:      UpdateEmployeeInput,
  actorUserId: string,
): Promise<Employee> {
  const existing = await db.employee.findFirst({
    where: { id: employeeId, organizationId: orgId },
    select: { id: true, isActive: true, userId: true, hourlyWage: true },
  })
  if (!existing) throw new ServiceError("Not found", "NOT_FOUND")

  if (input.jobRole !== undefined) await assertValidJobRole(orgId, input.jobRole)
  if (input.email !== undefined) input = { ...input, email: input.email.toLowerCase().trim() }

  // When the manager explicitly changes the wage, re-anchor the base to the
  // new value and the org's current currency so future currency conversions
  // always convert from the freshest manager-entered wage.
  let wageBaseUpdate: { wageBaseAmount: number; wageBaseCurrency: string } | undefined
  if (input.hourlyWage !== undefined) {
    const org = await db.organization.findUnique({ where: { id: orgId }, select: { currency: true } })
    wageBaseUpdate = {
      wageBaseAmount:   input.hourlyWage,
      wageBaseCurrency: org?.currency ?? "EUR",
    }
  }

  try {
    const employee = await db.$transaction(async (tx) => {
      // Reactivating consumes a seat exactly like hiring does. Only guard the
      // false → true transition; edits to an already-active employee, and
      // deactivations, must not be blocked by a full org.
      if (input.isActive === true && !existing.isActive) {
        await assertSeatAvailable(tx, orgId)
      }
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: {
          ...(input.name            !== undefined && { name: input.name }),
          ...(input.email           !== undefined && { email: input.email }),
          ...(input.phone           !== undefined && { phone: input.phone }),
          ...(input.jobRole         !== undefined && { jobRole: input.jobRole }),
          ...(input.hourlyWage      !== undefined && { hourlyWage: input.hourlyWage }),
          ...(wageBaseUpdate !== undefined && wageBaseUpdate),
          ...(input.notes           !== undefined && { notes: input.notes }),
          ...(input.isActive        !== undefined && { isActive: input.isActive }),
          ...(input.employmentType  !== undefined && isEmploymentType(input.employmentType) && { employmentType: input.employmentType }),
          ...(input.contractedHours !== undefined && { contractedHours: input.contractedHours }),
        },
      })
      if (input.name !== undefined && existing.userId) {
        await tx.user.update({ where: { id: existing.userId }, data: { name: input.name } })
      }
      return updated
    })

    if (input.isActive !== undefined && input.isActive !== existing.isActive) {
      syncSubscriptionQuantitySafe(orgId)
    }

    // Audit wage changes — who changed an employee's pay, and from/to what.
    if (input.hourlyWage !== undefined) {
      const before = (existing.hourlyWage as { toNumber(): number }).toNumber()
      const after  = (employee.hourlyWage as { toNumber(): number }).toNumber()
      if (before !== after) {
        recordAudit({
          orgId,
          actorUserId,
          action: "EMPLOYEE_WAGE_CHANGED",
          entity: `Employee:${employeeId}`,
          before: { hourlyWage: before },
          after:  { hourlyWage: after },
        })
      }
    }

    return serEmployee(employee)
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      throw new ServiceError("Email already in use", "CONFLICT")
    }
    throw err
  }
}

export async function deleteEmployee(
  orgId: string,
  employeeId: string,
  actorUserId?: string,
): Promise<void> {
  const existing = await db.employee.findFirst({
    where: { id: employeeId, organizationId: orgId },
    select: { id: true, isActive: true },
  })
  if (!existing) throw new ServiceError("Not found", "NOT_FOUND")

  // Hard delete. All child rows (shifts, time entries, availability, time-off)
  // declare onDelete: Cascade on their Employee relation, so this leaves no
  // orphans — satisfying the GDPR erasure (right to be forgotten) requirement.
  await db.employee.delete({ where: { id: employeeId } })

  if (actorUserId) {
    recordAudit({
      orgId,
      actorUserId,
      action: "EMPLOYEE_ERASED",
      entity: `Employee:${employeeId}`,
    })
  }

  syncSubscriptionQuantitySafe(orgId)
}

/**
 * GDPR data-subject export: every record we hold for one employee, returned as a
 * plain serializable object. Manager-scoped (caller must guard org membership).
 */
export async function exportEmployeeData(orgId: string, employeeId: string) {
  const employee = await db.employee.findFirst({
    where: { id: employeeId, organizationId: orgId },
    include: {
      shifts: true,
      timeEntries: true,
      timeOffRequests: true,
      availabilitySubmissions: true,
    },
  })
  if (!employee) throw new ServiceError("Not found", "NOT_FOUND")

  return {
    exportedAt: new Date().toISOString(),
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      jobRole: employee.jobRole,
      hourlyWage: Number(employee.hourlyWage),
      wageBaseAmount: employee.wageBaseAmount === null ? null : Number(employee.wageBaseAmount),
      wageBaseCurrency: employee.wageBaseCurrency,
      employmentType: employee.employmentType,
      contractedHours: employee.contractedHours,
      notes: employee.notes,
      isActive: employee.isActive,
      smsConsentAt: employee.smsConsentAt?.toISOString() ?? null,
      createdAt: employee.createdAt.toISOString(),
    },
    shifts: employee.shifts,
    timeEntries: employee.timeEntries,
    timeOffRequests: employee.timeOffRequests,
    availabilitySubmissions: employee.availabilitySubmissions,
  }
}

export async function getEmployeeByUserId(orgId: string, userId: string): Promise<Employee | null> {
  const employee = await db.employee.findFirst({
    where: { organizationId: orgId, userId },
    orderBy: { createdAt: "asc" },
  })
  return employee ? serEmployee(employee) : null
}

export async function getEmployeeById(orgId: string, employeeId: string): Promise<Employee | null> {
  const employee = await db.employee.findFirst({
    where: { id: employeeId, organizationId: orgId },
  })
  return employee ? serEmployee(employee) : null
}

/**
 * All sick-day records for an employee, newest first. Sick days are stored as
 * shifts with colorTag "sick" (see handleMarkSick); startTime/endTime carry the
 * hours the person was expected to work and `notes` holds the reason.
 */
export async function listSickDays(orgId: string, employeeId: string): Promise<Shift[]> {
  const shifts = await db.shift.findMany({
    where: { organizationId: orgId, employeeId, colorTag: "sick" },
    orderBy: { date: "desc" },
  })
  return shifts.map(serShift)
}

export async function refreshInviteToken(orgId: string, employeeId: string): Promise<Employee> {
  const employee = await db.employee.findFirst({
    where: { id: employeeId, organizationId: orgId, isActive: true },
  })
  if (!employee) throw new ServiceError("Employee not found", "NOT_FOUND")

  const [updated, org] = await Promise.all([
    db.employee.update({
      where: { id: employeeId },
      data: {
        inviteToken:  crypto.randomUUID(),
        inviteExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
    db.organization.findUnique({ where: { id: orgId }, select: { name: true, locale: true } }),
  ])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const newToken = updated.inviteToken ?? ""
  sendInviteEmail({
    to:        employee.email,
    name:      employee.name,
    orgName:   org?.name ?? "",
    inviteUrl: `${appUrl}/portal`,
    joinUrl:   `${appUrl}/join/${newToken}`,
    locale:    resolveRecipientLocale(updated.locale, org?.locale),
  }).catch((err) => console.error("[invite] Resend error:", err))

  return serEmployee(updated)
}

export type ClaimInviteResult = {
  organizationId: string
  employeeId:     string
  employeeName:   string
  orgName:        string
  /** Whether this user already has a verified phone (skips the SMS step). */
  phoneVerified:  boolean
}

export type ClaimableEmployee = {
  id:                  string
  organizationId:      string
  email:               string
  name:                string
  orgName:             string
  /** Message language for this recipient (employee locale → org locale → en). */
  locale:              ReturnType<typeof resolveRecipientLocale>
  /** True when the invite is already linked to this same user (claim is idempotent). */
  alreadyLinkedToUser: boolean
}

/**
 * Resolve the employee an invite token points to, enforcing the same ownership
 * rules as claimInvite WITHOUT mutating anything. Used by the claim-code flow to
 * decide whether to issue a verification code. Throws ServiceError on an invalid/
 * expired token (404) or a token already claimed by someone else (409).
 */
export async function getClaimableEmployee(
  token:  string,
  userId: string,
): Promise<ClaimableEmployee> {
  const employee = await db.employee.findFirst({
    where: { inviteToken: token, isActive: true, inviteExpiry: { gt: new Date() } },
    include: { organization: { select: { name: true, locale: true } } },
    orderBy: { createdAt: "asc" },
  })
  if (!employee) {
    throw new ServiceError("Invalid or expired invite link", "NOT_FOUND")
  }
  if (employee.userId && employee.userId !== userId) {
    throw new ServiceError("This invite has already been claimed", "CONFLICT")
  }
  return {
    id:                  employee.id,
    organizationId:      employee.organizationId,
    email:               employee.email,
    name:                employee.name,
    orgName:             employee.organization.name,
    locale:              resolveRecipientLocale(employee.locale, employee.organization.locale),
    alreadyLinkedToUser: employee.userId === userId,
  }
}

/**
 * Links a signed-in user to their employee record via the invite token.
 *
 * - Validates the token is active and not expired.
 * - If employee.userId is already set to a different user → CONFLICT.
 * - If already set to this user → idempotent success.
 * - In a transaction: sets employee.userId and upserts an EMPLOYEE Membership,
 *   but does NOT downgrade an existing MANAGER membership.
 * - Does NOT clear inviteToken — the availability link continues to work.
 */
export async function claimInvite(
  token:  string,
  userId: string,
): Promise<ClaimInviteResult> {
  const employee = await db.employee.findFirst({
    where: {
      inviteToken: token,
      isActive:    true,
      inviteExpiry: { gt: new Date() },
    },
    include: {
      organization: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  if (!employee) {
    throw new ServiceError("Invalid or expired invite link", "NOT_FOUND")
  }

  // Already claimed by a different user
  if (employee.userId && employee.userId !== userId) {
    throw new ServiceError("This invite has already been claimed", "CONFLICT")
  }

  // A phone the user already verified on any of their employee rows. One person
  // has one number across every org, so we carry it onto newly-linked records
  // and skip re-verifying.
  const verified = await db.employee.findFirst({
    where: { userId, phoneVerifiedAt: { not: null } },
    orderBy: { phoneVerifiedAt: "desc" },
    select: { phone: true, phoneVerifiedAt: true, smsConsentAt: true },
  })

  // Idempotent: already linked to this user
  if (employee.userId === userId) {
    return {
      organizationId: employee.organizationId,
      employeeId:     employee.id,
      employeeName:   employee.name,
      orgName:        employee.organization.name,
      phoneVerified:  !!(employee.phoneVerifiedAt || verified),
    }
  }

  // Link user to employee and create/update membership without downgrading manager
  await db.$transaction(async (tx) => {
    const client = tx as unknown as PrismaClient

    await client.employee.update({
      where: { id: employee.id },
      // Carry over an already-verified number so a returning employee joining a
      // second org doesn't have to verify again (and their new manager sees it).
      data:  {
        userId,
        ...(verified
          ? {
              phone:           verified.phone,
              phoneVerifiedAt: verified.phoneVerifiedAt,
              smsConsentAt:    verified.smsConsentAt,
            }
          : {}),
      },
    })

    // Upsert an EMPLOYEE membership. The update branch is a deliberate no-op so
    // an existing MANAGER membership is never downgraded to EMPLOYEE.
    await client.membership.upsert({
      where:  { userId_organizationId: { userId, organizationId: employee.organizationId } },
      create: { userId, organizationId: employee.organizationId, role: "EMPLOYEE" },
      update: {}, // no-op: preserve whatever role already exists
    })
  })

  return {
    organizationId: employee.organizationId,
    employeeId:     employee.id,
    employeeName:   employee.name,
    orgName:        employee.organization.name,
    phoneVerified:  !!verified,
  }
}
