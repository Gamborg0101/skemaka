/**
 * Tests for the web-push send helper — delivery fan-out, graceful no-op when
 * VAPID keys are absent, and pruning of expired endpoints.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import webpush from "web-push"
import { db } from "@/lib/prisma"
import { sendPushToUsers } from "@/lib/push"

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({
  db: {
    pushSubscription: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

const mockFindMany = vi.mocked(db.pushSubscription.findMany)
const mockDeleteMany = vi.mocked(db.pushSubscription.deleteMany)
const mockSend = vi.mocked(webpush.sendNotification)

function sub(id: string, endpoint: string) {
  return { id, userId: "u1", endpoint, p256dh: "k", auth: "a", userAgent: null, createdAt: new Date() }
}

beforeEach(() => {
  vi.clearAllMocks()
  // The module caches its config check; env vars are read once on first send.
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub"
  process.env.VAPID_PRIVATE_KEY = "priv"
  mockDeleteMany.mockResolvedValue({ count: 0 } as never)
})

describe("sendPushToUsers", () => {
  it("sends the payload to every subscription of the given users", async () => {
    mockFindMany.mockResolvedValue([sub("s1", "https://push/1"), sub("s2", "https://push/2")] as never)
    mockSend.mockResolvedValue({} as never)

    const delivered = await sendPushToUsers(["u1"], { title: "Cafe", body: "Shifts published", url: "/portal" })

    expect(delivered).toBe(2)
    expect(mockSend).toHaveBeenCalledTimes(2)
    expect(mockSend).toHaveBeenCalledWith(
      { endpoint: "https://push/1", keys: { p256dh: "k", auth: "a" } },
      JSON.stringify({ title: "Cafe", body: "Shifts published", url: "/portal" }),
    )
  })

  it("prunes subscriptions the push service reports as gone", async () => {
    mockFindMany.mockResolvedValue([sub("s1", "https://push/1"), sub("s2", "https://push/2")] as never)
    mockSend
      .mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }))
      .mockResolvedValueOnce({} as never)

    const delivered = await sendPushToUsers(["u1"], { title: "t", body: "b" })

    expect(delivered).toBe(1)
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["s1"] } } })
  })

  it("swallows transient send failures without pruning", async () => {
    mockFindMany.mockResolvedValue([sub("s1", "https://push/1")] as never)
    mockSend.mockRejectedValue(Object.assign(new Error("throttled"), { statusCode: 429 }))

    const delivered = await sendPushToUsers(["u1"], { title: "t", body: "b" })

    expect(delivered).toBe(0)
    expect(mockDeleteMany).not.toHaveBeenCalled()
  })

  it("is a no-op for an empty user list", async () => {
    const delivered = await sendPushToUsers([], { title: "t", body: "b" })
    expect(delivered).toBe(0)
    expect(mockFindMany).not.toHaveBeenCalled()
  })
})
