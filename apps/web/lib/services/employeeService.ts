import { db } from "@/lib/prisma"
import { serEmployee } from "@/lib/serialize"
import { isEmploymentType } from "@/types"
import type { Employee } from "@/types"
import type { PaginationParams, Paginated } from "@/lib/validate"
import { sendInviteEmail } from "@/lib/resend"
import { ServiceError } from "./errors"

export async function listEmployees(orgId: string): Promise<Employee[]>
export async function listEmployees(orgId: string, pagination: PaginationParams): Promise<Paginated<Employee>>
export async function listEmployees(
  orgId: string,
  pagination?: PaginationParams,
): Promise<Employee[] | Paginated<Employee>> {
  if (!pagination) {
    const employees = await db.employee.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    })
    return employees.map(serEmployee)
  }
  const [employees, total] = await Promise.all([
    db.employee.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      take:  pagination.limit,
      skip:  pagination.offset,
    }),
    db.employee.count({ where: { organizationId: orgId } }),
  ])
  return {
    data: employees.map(serEmployee),
    meta: { total, limit: pagination.limit, offset: pagination.offset },
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

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true, currency: true } })

  const employee = await db.employee.create({
    data: {
      organizationId:   orgId,
      name:             input.name,
      email:            email,
      phone:            input.phone           ?? null,
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  sendInviteEmail({
    to:        employee.email,
    name:      employee.name,
    orgName:   org?.name ?? "",
    inviteUrl: `${appUrl}/portal`,
  }).catch((err) => console.error("[invite] Resend error:", err))

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
): Promise<Employee> {
  const existing = await db.employee.findFirst({
    where: { id: employeeId, organizationId: orgId },
    select: { id: true, isActive: true, userId: true },
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
    return serEmployee(employee)
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      throw new ServiceError("Email already in use", "CONFLICT")
    }
    throw err
  }
}

export async function deleteEmployee(orgId: string, employeeId: string): Promise<void> {
  const existing = await db.employee.findFirst({
    where: { id: employeeId, organizationId: orgId },
    select: { id: true, isActive: true },
  })
  if (!existing) throw new ServiceError("Not found", "NOT_FOUND")

  await db.employee.delete({ where: { id: employeeId } })
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
    db.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
  ])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  sendInviteEmail({
    to:        employee.email,
    name:      employee.name,
    orgName:   org?.name ?? "",
    inviteUrl: `${appUrl}/portal`,
  }).catch((err) => console.error("[invite] Resend error:", err))

  return serEmployee(updated)
}
