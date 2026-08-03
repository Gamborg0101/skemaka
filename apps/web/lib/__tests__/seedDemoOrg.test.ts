/**
 * seedDemoOrg is now only the *writer*: it turns a plan into rows.
 *
 * What the sandbox actually contains — that every employee is rostered, that
 * nobody is double-booked, that the visitor never lands on an empty day — is
 * asserted in demoIntegrity.test.ts against the pure planner, with no mocks.
 * Keep content assertions there; keep "did it write to the right table" here.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import { seedDemoOrg } from "@/lib/demo/seedDemoOrg"
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo/constants"
import { buildDemoPlan } from "@/lib/demo/demoPlan"

vi.mock("server-only", () => ({}))

vi.mock("@/lib/prisma", () => ({
  db: {
    organization: { create: vi.fn() },
    user: { create: vi.fn() },
    membership: { create: vi.fn() },
    jobRole: { createMany: vi.fn() },
    shiftTemplate: { createMany: vi.fn() },
    employee: { createMany: vi.fn() },
    schedule: { createMany: vi.fn() },
    shift: { createMany: vi.fn() },
    timeEntry: { createMany: vi.fn() },
    availabilityRequest: { create: vi.fn() },
    availabilitySubmission: { create: vi.fn() },
    availabilityDay: { createMany: vi.fn() },
    timeOffRequest: { createMany: vi.fn() },
    shiftCoverRequest: { create: vi.fn() },
    shiftOffer: { create: vi.fn() },
  },
}))

type AnyRow = Record<string, unknown>

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.organization.create).mockResolvedValue({ id: "org_demo" } as never)
  vi.mocked(db.user.create).mockResolvedValue({ id: "user_demo" } as never)
  vi.mocked(db.membership.create).mockResolvedValue({} as never)
  vi.mocked(db.jobRole.createMany).mockResolvedValue({ count: 3 } as never)
  vi.mocked(db.shiftTemplate.createMany).mockResolvedValue({ count: 4 } as never)
  vi.mocked(db.employee.createMany).mockResolvedValue({ count: 9 } as never)
  vi.mocked(db.schedule.createMany).mockResolvedValue({ count: 16 } as never)
  vi.mocked(db.shift.createMany).mockImplementation((async (args: { data: AnyRow[] }) => ({
    count: args.data.length,
  })) as never)
  vi.mocked(db.timeEntry.createMany).mockResolvedValue({ count: 0 } as never)
  vi.mocked(db.availabilityRequest.create).mockResolvedValue({ id: "avail_1" } as never)
  let sub = 0
  vi.mocked(db.availabilitySubmission.create).mockImplementation((async () => ({ id: `sub_${++sub}` })) as never)
  vi.mocked(db.availabilityDay.createMany).mockResolvedValue({ count: 7 } as never)
  vi.mocked(db.timeOffRequest.createMany).mockResolvedValue({ count: 2 } as never)
  vi.mocked(db.shiftCoverRequest.create).mockResolvedValue({} as never)
  vi.mocked(db.shiftOffer.create).mockResolvedValue({} as never)
})

const rows = (mock: { mock: { calls: unknown[][] } }, call = 0): AnyRow[] =>
  (mock.mock.calls[call][0] as { data: AnyRow[] }).data

describe("seedDemoOrg", () => {
  it("creates a demo-flagged org and a manager the visitor signs in as", async () => {
    const result = await seedDemoOrg("en")

    expect(db.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isDemo: true, subscriptionStatus: "TRIALING" }),
      }),
    )
    expect(result.userId).toBe("user_demo")
    expect(result.orgId).toBe("org_demo")
    expect(result.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)).toBe(true)
    expect(db.membership.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "MANAGER" }) }),
    )
  })

  it("seeds 9 unreachable employees (demo domain, no phone, no user)", async () => {
    await seedDemoOrg("en")
    const employees = rows(vi.mocked(db.employee.createMany))
    expect(employees).toHaveLength(9)
    for (const e of employees) {
      expect((e.email as string).endsWith(`@${DEMO_EMAIL_DOMAIN}`)).toBe(true)
      expect(e.phone).toBeNull()
      expect(e.userId).toBeNull()
    }
  })

  it("uses the Danish cast for da sandboxes", async () => {
    await seedDemoOrg("da")
    const names = rows(vi.mocked(db.employee.createMany)).map((e) => e.name)
    expect(names).toContain("Mads Jensen")
    expect(names).toContain("Sofie Larsen")
    expect((vi.mocked(db.organization.create).mock.calls[0][0] as { data: AnyRow }).data).toMatchObject({
      currency: "DKK",
      locale: "da",
    })
  })

  it("writes every row the plan describes, to the right table", async () => {
    await seedDemoOrg("en")
    const plan = buildDemoPlan({ locale: "en" })

    expect(rows(vi.mocked(db.schedule.createMany))).toHaveLength(plan.schedules.length)
    expect(rows(vi.mocked(db.jobRole.createMany))).toHaveLength(plan.jobRoles.length)
    expect(rows(vi.mocked(db.shiftTemplate.createMany))).toHaveLength(plan.shiftTemplates.length)
    expect(rows(vi.mocked(db.shift.createMany))).toHaveLength(plan.shifts.length)
    expect(rows(vi.mocked(db.timeOffRequest.createMany))).toHaveLength(plan.timeOff.length)
    expect(db.availabilitySubmission.create).toHaveBeenCalledTimes(plan.availability.submissions.length)
    expect(db.shiftCoverRequest.create).toHaveBeenCalledOnce()
    expect(db.shiftOffer.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "OPEN" }) }),
    )
  })

  it("stores dates at UTC midnight, matching the schema convention", async () => {
    await seedDemoOrg("en")
    for (const s of rows(vi.mocked(db.schedule.createMany))) {
      const d = s.weekStart as Date
      expect([d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]).toEqual([0, 0, 0])
    }
    for (const s of rows(vi.mocked(db.shift.createMany))) {
      expect((s.date as Date).getUTCHours()).toBe(0)
    }
  })

  it("clocks time entries only in the past, never for a cancelled shift", async () => {
    await seedDemoOrg("en")

    const shifts = rows(vi.mocked(db.shift.createMany))
    const entries = rows(vi.mocked(db.timeEntry.createMany))
    expect(entries.length).toBeGreaterThan(100)

    const now = Date.now()
    for (const e of entries) expect((e.clockIn as Date).getTime()).toBeLessThan(now)

    const cancelled = new Set(shifts.filter((s) => s.cancelledAt !== null).map((s) => s.id))
    expect(cancelled.size).toBe(1)
    expect(entries.filter((e) => cancelled.has(e.shiftId))).toEqual([])

    expect(shifts.filter((s) => s.colorTag === "sick")).toHaveLength(2)
  })

  it("refuses to write anything when the plan is incoherent", async () => {
    const { assertDemoPlan } = await import("@/lib/demo/seedDemoOrg")
    const plan = buildDemoPlan({ locale: "en" })
    // Close a day — the UI opens on the real date, so this strands a visitor.
    plan.org.settings.hours[0].isOpen = false

    expect(() => assertDemoPlan(plan)).toThrow(/DEMO-0(20|22|30)/)
    expect(db.organization.create).not.toHaveBeenCalled()
  })
})
