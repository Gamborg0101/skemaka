import { db } from "@/lib/prisma"

/**
 * Throwaway rows for integration tests.
 *
 * Every org is created with a unique slug and torn down afterwards, so tests
 * neither collide nor leak. Deleting the org cascades to employees, schedules
 * and shifts (see the onDelete: Cascade relations in schema.prisma), which is
 * itself worth exercising — a cascade that silently stops working would leave
 * orphans no unit test would notice.
 */

let seq = 0
const created: string[] = []

export async function makeOrg(overrides: Partial<{
  seats: number
  subscriptionStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED"
  trialEndsAt: Date | null
}> = {}) {
  const n = ++seq
  const suffix = `${Date.now().toString(36)}-${n}`
  const org = await db.organization.create({
    data: {
      name: `IT Org ${suffix}`,
      slug: `it-${suffix}`,
      currency: "EUR",
      seats: overrides.seats ?? 5,
      subscriptionStatus: overrides.subscriptionStatus ?? "ACTIVE",
      trialEndsAt: overrides.trialEndsAt ?? null,
    },
  })
  created.push(org.id)
  await db.jobRole.create({
    data: { organizationId: org.id, name: "Kitchen", color: "orange" },
  })
  return org
}

export async function makeEmployee(orgId: string, overrides: Partial<{
  isActive: boolean
  email: string
  name: string
}> = {}) {
  const n = ++seq
  return db.employee.create({
    data: {
      organizationId: orgId,
      name: overrides.name ?? `Employee ${n}`,
      email: overrides.email ?? `emp-${Date.now().toString(36)}-${n}@example.test`,
      jobRole: "Kitchen",
      hourlyWage: 100,
      wageBaseAmount: 100,
      wageBaseCurrency: "EUR",
      isActive: overrides.isActive ?? true,
    },
  })
}

export async function makeSchedule(orgId: string, weekStart: string) {
  return db.schedule.create({
    data: { organizationId: orgId, weekStart: new Date(weekStart + "T00:00:00Z") },
  })
}

export async function makeShift(opts: {
  orgId: string
  scheduleId: string
  employeeId: string
  date: string
  colorTag?: string | null
  publishedAt?: Date | null
  startTime?: string
  endTime?: string
}) {
  return db.shift.create({
    data: {
      organizationId: opts.orgId,
      scheduleId: opts.scheduleId,
      employeeId: opts.employeeId,
      date: new Date(opts.date + "T00:00:00Z"),
      startTime: opts.startTime ?? "09:00",
      endTime: opts.endTime ?? "17:00",
      breakMinutes: 0,
      jobRole: "Kitchen",
      // Explicitly allowed to be null — that is the case under test.
      colorTag: opts.colorTag === undefined ? "orange" : opts.colorTag,
      publishedAt: opts.publishedAt ?? null,
    },
  })
}

/** Remove every org this run created. Call from afterAll. */
export async function cleanup() {
  if (created.length === 0) return
  await db.organization.deleteMany({ where: { id: { in: created } } })
  created.length = 0
}
