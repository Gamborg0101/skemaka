import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import { seedDemoOrg } from "@/lib/demo/seedDemoOrg"
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo/constants"

vi.mock("server-only", () => ({}))

vi.mock("@/lib/prisma", () => ({
  db: {
    organization: { create: vi.fn() },
    user: { create: vi.fn() },
    membership: { create: vi.fn() },
    jobRole: { createMany: vi.fn() },
    shiftTemplate: { createMany: vi.fn() },
    employee: { createMany: vi.fn() },
    schedule: { create: vi.fn() },
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
  vi.mocked(db.schedule.create).mockImplementation((async (args: { data: AnyRow }) => args.data) as never)
  vi.mocked(db.shift.createMany).mockResolvedValue({ count: 0 } as never)
  vi.mocked(db.timeEntry.createMany).mockResolvedValue({ count: 0 } as never)
  vi.mocked(db.availabilityRequest.create).mockResolvedValue({ id: "avail_1" } as never)
  let sub = 0
  vi.mocked(db.availabilitySubmission.create).mockImplementation((async () => ({ id: `sub_${++sub}` })) as never)
  vi.mocked(db.availabilityDay.createMany).mockResolvedValue({ count: 7 } as never)
  vi.mocked(db.timeOffRequest.createMany).mockResolvedValue({ count: 2 } as never)
  vi.mocked(db.shiftCoverRequest.create).mockResolvedValue({} as never)
  vi.mocked(db.shiftOffer.create).mockResolvedValue({} as never)
})

function createdShifts(): AnyRow[] {
  return vi.mocked(db.shift.createMany).mock.calls[0][0]!.data as AnyRow[]
}

describe("seedDemoOrg", () => {
  it("creates a demo-flagged org and a manager the visitor signs in as", async () => {
    const result = await seedDemoOrg("en")

    expect(db.organization.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isDemo: true, subscriptionStatus: "TRIALING" }),
    }))
    expect(result.userId).toBe("user_demo")
    expect(result.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)).toBe(true)
    expect(db.membership.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: "MANAGER" }),
    }))
  })

  it("seeds 9 unreachable employees (demo domain, no phone, no user)", async () => {
    await seedDemoOrg("en")
    const employees = vi.mocked(db.employee.createMany).mock.calls[0][0]!.data as AnyRow[]
    expect(employees).toHaveLength(9)
    for (const e of employees) {
      expect((e.email as string).endsWith(`@${DEMO_EMAIL_DOMAIN}`)).toBe(true)
      expect(e.phone).toBeNull()
      expect(e.userId).toBeNull()
    }
  })

  it("uses the Danish cast for da sandboxes", async () => {
    await seedDemoOrg("da")
    const employees = vi.mocked(db.employee.createMany).mock.calls[0][0]!.data as AnyRow[]
    const names = employees.map((e) => e.name)
    expect(names).toContain("Mads Jensen")
    expect(names).toContain("Sofie Larsen")
    expect(vi.mocked(db.organization.create).mock.calls[0][0]!.data).toMatchObject({ currency: "DKK", locale: "da" })
  })

  it("creates 16 weeks: past + near-future rolled out, weeks +2… as drafts", async () => {
    await seedDemoOrg("en")

    const schedules = vi.mocked(db.schedule.create).mock.calls.map((c) => c[0].data as AnyRow)
    expect(schedules).toHaveLength(16)
    expect(schedules.filter((s) => s.publishedAt !== null)).toHaveLength(10) // -8…+1
    expect(schedules.filter((s) => s.publishedAt === null)).toHaveLength(6)  // +2…+7

    const shifts = createdShifts()
    expect(shifts.length).toBeGreaterThan(300)
    const drafts = shifts.filter((s) => s.publishedAt === null)
    const published = shifts.filter((s) => s.publishedAt !== null)
    expect(drafts.length).toBeGreaterThan(80)     // ~6 draft weeks
    expect(published.length).toBeGreaterThan(200) // ~10 rolled-out weeks
  })

  it("adds time entries only for past shifts, plus sick days and a cancelled shift", async () => {
    await seedDemoOrg("en")

    const shifts = createdShifts()
    const entries = vi.mocked(db.timeEntry.createMany).mock.calls[0][0]!.data as AnyRow[]
    expect(entries.length).toBeGreaterThan(100)
    const now = Date.now()
    for (const e of entries) {
      expect((e.clockIn as Date).getTime()).toBeLessThan(now)
    }
    expect(shifts.filter((s) => s.colorTag === "sick")).toHaveLength(2)
    expect(shifts.filter((s) => s.cancelledAt !== null)).toHaveLength(1)
  })

  it("garnishes every feature: availability, time off, cover, offer", async () => {
    await seedDemoOrg("en")

    expect(db.availabilityRequest.create).toHaveBeenCalledOnce()
    expect(db.availabilitySubmission.create).toHaveBeenCalledTimes(5)
    // One submitter marked two days unavailable → Day Off badges.
    const dayBatches = vi.mocked(db.availabilityDay.createMany).mock.calls
      .map((c) => c[0]!.data as AnyRow[])
    const unavailable = dayBatches.flat().filter((d) => d.isAvailable === false)
    expect(unavailable).toHaveLength(2)

    expect(db.timeOffRequest.createMany).toHaveBeenCalledOnce()
    expect(db.shiftCoverRequest.create).toHaveBeenCalledOnce()
    expect(db.shiftOffer.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "OPEN" }),
    }))
  })
})
