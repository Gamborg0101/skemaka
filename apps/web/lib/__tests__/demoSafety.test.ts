/**
 * Safety rails for the "try the live demo" sandboxes: outbound email to
 * demo-domain recipients is suppressed, and the cleanup cron deletes expired
 * sandboxes (orgs by TTL, then their orphaned users).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { DEMO_EMAIL_DOMAIN, DEMO_TTL_HOURS } from "@/lib/demo/constants"

vi.mock("server-only", () => ({}))

const sendMock = vi.fn().mockResolvedValue({ id: "email_1" })
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

vi.mock("@/lib/prisma", () => ({
  db: {
    organization: { deleteMany: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    user: { deleteMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    schedule: { findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    availabilityRequest: { deleteMany: vi.fn() },
    schedulingEvent: { deleteMany: vi.fn() },
  },
}))

import { sendShiftAssignedEmail } from "@/lib/resend"
import { cleanupDemoSandboxes, deleteDemoSandbox } from "@/lib/cleanup"
import { db } from "@/lib/prisma"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("demo email suppression", () => {
  const base = {
    name: "Emma", orgName: "The Copper Pan", dateLabel: "Friday 18 July",
    startTime: "16:00", endTime: "23:00", jobRole: "Front of house",
  }

  it("drops mail to demo-domain recipients", async () => {
    await sendShiftAssignedEmail({ ...base, to: `emma-abc123@${DEMO_EMAIL_DOMAIN}` })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("still delivers to real recipients", async () => {
    await sendShiftAssignedEmail({ ...base, to: "emma@example.com" })
    expect(sendMock).toHaveBeenCalledOnce()
  })
})

describe("cleanupDemoSandboxes", () => {
  it("deletes demo orgs past the TTL and orphaned demo users", async () => {
    vi.mocked(db.organization.deleteMany).mockResolvedValue({ count: 3 } as never)
    vi.mocked(db.user.deleteMany).mockResolvedValue({ count: 3 } as never)

    const before = Date.now() - DEMO_TTL_HOURS * 60 * 60 * 1000
    const result = await cleanupDemoSandboxes()

    expect(result).toEqual({ orgs: 3, users: 3 })
    const orgCall = vi.mocked(db.organization.deleteMany).mock.calls[0][0]!
    expect(orgCall.where).toMatchObject({ isDemo: true })
    const cutoff = (orgCall.where!.createdAt as { lt: Date }).lt
    expect(Math.abs(cutoff.getTime() - before)).toBeLessThan(5_000)

    expect(db.user.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` },
        memberships: { none: {} },
      }),
    }))
  })
})

describe("deleteDemoSandbox", () => {
  it("only ever deletes an org that is flagged isDemo", async () => {
    vi.mocked(db.organization.deleteMany).mockResolvedValue({ count: 1 } as never)
    vi.mocked(db.user.deleteMany).mockResolvedValue({ count: 1 } as never)

    await expect(deleteDemoSandbox("org_demo")).resolves.toBe(true)

    // The isDemo guard is the whole safety story: this runs from a user-facing
    // "Reset demo" button, and a reset that could delete a paying customer's
    // organization is not a bug anyone recovers from.
    expect(db.organization.deleteMany).toHaveBeenCalledWith({
      where: { id: "org_demo", isDemo: true },
    })
  })

  it("touches no users when the org was not a demo org", async () => {
    vi.mocked(db.organization.deleteMany).mockResolvedValue({ count: 0 } as never)

    await expect(deleteDemoSandbox("org_real")).resolves.toBe(false)
    expect(db.user.deleteMany).not.toHaveBeenCalled()
  })
})
