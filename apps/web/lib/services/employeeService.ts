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

export async function createEmployee(orgId: string, input: CreateEmployeeInput): Promise<Employee> {
  const existing = await db.employee.findUnique({
    where: { organizationId_email: { organizationId: orgId, email: input.email } },
  })
  if (existing) throw new ServiceError("An employee with this email already exists", "CONFLICT")

  const resolvedType = input.employmentType && isEmploymentType(input.employmentType)
    ? input.employmentType
    : "PART_TIME"

  const employee = await db.employee.create({
    data: {
      organizationId:  orgId,
      name:            input.name,
      email:           input.email,
      phone:           input.phone           ?? null,
      jobRole:         input.jobRole,
      hourlyWage:      input.hourlyWage,
      employmentType:  resolvedType,
      contractedHours: input.contractedHours ?? 0,
      notes:           input.notes           ?? null,
      inviteToken:     crypto.randomUUID(),
      inviteExpiry:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  await db.organization.update({
    where: { id: orgId },
    data:  { employeeCount: { increment: 1 } },
  })

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
    select: { id: true, isActive: true },
  })
  if (!existing) throw new ServiceError("Not found", "NOT_FOUND")

  const countDelta =
    input.isActive !== undefined && input.isActive !== existing.isActive
      ? input.isActive ? 1 : -1
      : 0

  try {
    const employee = await db.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: {
          ...(input.name           !== undefined && { name: input.name }),
          ...(input.email          !== undefined && { email: input.email }),
          ...(input.phone          !== undefined && { phone: input.phone }),
          ...(input.jobRole        !== undefined && { jobRole: input.jobRole }),
          ...(input.hourlyWage     !== undefined && { hourlyWage: input.hourlyWage }),
          ...(input.notes          !== undefined && { notes: input.notes }),
          ...(input.isActive       !== undefined && { isActive: input.isActive }),
          ...(input.employmentType !== undefined && isEmploymentType(input.employmentType) && { employmentType: input.employmentType }),
          ...(input.contractedHours !== undefined && { contractedHours: input.contractedHours }),
        },
      })
      if (countDelta !== 0) {
        await tx.organization.update({
          where: { id: orgId },
          data:  { employeeCount: countDelta > 0 ? { increment: 1 } : { decrement: 1 } },
        })
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

  if (existing.isActive) {
    await db.organization.update({
      where: { id: orgId },
      data:  { employeeCount: { decrement: 1 } },
    })
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
  void sendInviteEmail({
    to:        employee.email,
    name:      employee.name,
    orgName:   org?.name ?? "",
    inviteUrl: `${appUrl}/portal`,
  })

  return serEmployee(updated)
}
