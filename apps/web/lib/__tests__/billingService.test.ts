/**
 * Tests for per-employee subscription quantity sync — the billing model is
 * priced per active employee, so the Stripe quantity must track the
 * active-employee count on every add / deactivate / delete.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import {
  syncSubscriptionQuantity,
  syncSubscriptionQuantitySafe,
  activeSeatCount,
} from "@/lib/services/billingService"

vi.mock("@/lib/prisma", () => ({
  db: {
    organization: { findUnique: vi.fn() },
    employee: { count: vi.fn() },
  },
}))

vi.mock("@/lib/stripe", () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn() },
    subscriptionItems: { update: vi.fn() },
  },
}))

const mockFindUnique = vi.mocked(db.organization.findUnique)
const mockCount = vi.mocked(db.employee.count)
const mockRetrieve = vi.mocked(stripe.subscriptions.retrieve)
const mockItemUpdate = vi.mocked(stripe.subscriptionItems.update)

function stubSubscription(itemQuantity: number) {
  mockRetrieve.mockResolvedValue({
    items: { data: [{ id: "si_1", quantity: itemQuantity }] },
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFindUnique.mockResolvedValue({ stripeSubscriptionId: "sub_1" } as never)
})

describe("activeSeatCount", () => {
  it("counts only active employees", async () => {
    mockCount.mockResolvedValue(7)
    expect(await activeSeatCount("org1")).toBe(7)
    expect(mockCount).toHaveBeenCalledWith({
      where: { organizationId: "org1", isActive: true },
    })
  })

  it("floors at one seat so the subscription stays valid", async () => {
    mockCount.mockResolvedValue(0)
    expect(await activeSeatCount("org1")).toBe(1)
  })
})

describe("syncSubscriptionQuantity", () => {
  it("does nothing for orgs without a subscription (trialing)", async () => {
    mockFindUnique.mockResolvedValue({ stripeSubscriptionId: null } as never)
    await syncSubscriptionQuantity("org1")
    expect(mockRetrieve).not.toHaveBeenCalled()
    expect(mockItemUpdate).not.toHaveBeenCalled()
  })

  it("updates the Stripe quantity when it differs from the seat count", async () => {
    mockCount.mockResolvedValue(5)
    stubSubscription(3)
    await syncSubscriptionQuantity("org1")
    expect(mockItemUpdate).toHaveBeenCalledWith("si_1", {
      quantity: 5,
      proration_behavior: "create_prorations",
    })
  })

  it("skips the Stripe write when the quantity already matches", async () => {
    mockCount.mockResolvedValue(3)
    stubSubscription(3)
    await syncSubscriptionQuantity("org1")
    expect(mockItemUpdate).not.toHaveBeenCalled()
  })
})

describe("syncSubscriptionQuantitySafe", () => {
  it("swallows Stripe failures so employee CRUD never breaks", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    mockCount.mockResolvedValue(2)
    mockRetrieve.mockRejectedValue(new Error("stripe down"))

    expect(() => syncSubscriptionQuantitySafe("org1")).not.toThrow()
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled())
    consoleError.mockRestore()
  })
})
