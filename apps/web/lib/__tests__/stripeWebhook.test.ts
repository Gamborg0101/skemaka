/**
 * Stripe webhook handler tests — verifies signature rejection, the
 * Stripe-status → SubscriptionStatus mapping, and the customer-hijack guard
 * on checkout completion.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { stripe } from "@/lib/stripe"
import { db } from "@/lib/prisma"
import { POST } from "@/app/api/webhooks/stripe/route"

vi.mock("@/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: vi.fn() } },
}))

vi.mock("@/lib/prisma", () => ({
  db: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

const mockConstructEvent = vi.mocked(stripe.webhooks.constructEvent)
const mockFindUnique = vi.mocked(db.organization.findUnique)
const mockUpdate = vi.mocked(db.organization.update)
const mockUpdateMany = vi.mocked(db.organization.updateMany)

function webhookRequest(withSignature = true) {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: "raw-payload",
    headers: withSignature ? { "stripe-signature": "sig_test" } : {},
  })
}

function stubEvent(type: string, object: Record<string, unknown>) {
  mockConstructEvent.mockReturnValue({ type, data: { object } } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("signature verification", () => {
  it("rejects requests without a stripe-signature header", async () => {
    const res = await POST(webhookRequest(false))
    expect(res.status).toBe(400)
    expect(mockConstructEvent).not.toHaveBeenCalled()
  })

  it("rejects requests with an invalid signature", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("bad signature")
    })
    const res = await POST(webhookRequest())
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })
})

describe("checkout.session.completed", () => {
  const session = {
    mode: "subscription",
    metadata: { organizationId: "org1" },
    customer: "cus_123",
    subscription: "sub_123",
  }

  it("activates the org and stores Stripe ids", async () => {
    stubEvent("checkout.session.completed", session)
    mockFindUnique.mockResolvedValue({ stripeCustomerId: null } as never)

    const res = await POST(webhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "org1" },
      data: {
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        subscriptionStatus: "ACTIVE",
      },
    })
  })

  it("rejects a customer mismatch (billing hijack guard)", async () => {
    stubEvent("checkout.session.completed", session)
    mockFindUnique.mockResolvedValue({ stripeCustomerId: "cus_SOMEONE_ELSE" } as never)

    const res = await POST(webhookRequest())
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("ignores sessions without org metadata", async () => {
    stubEvent("checkout.session.completed", { ...session, metadata: {} })
    const res = await POST(webhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe("subscription lifecycle status mapping", () => {
  it.each([
    ["active", "ACTIVE"],
    ["trialing", "TRIALING"],
    ["past_due", "PAST_DUE"],
    ["unpaid", "PAST_DUE"],
    ["canceled", "CANCELED"],
    ["paused", "CANCELED"],
    ["incomplete_expired", "CANCELED"],
  ])("maps customer.subscription.updated %s → %s", async (stripeStatus, dbStatus) => {
    stubEvent("customer.subscription.updated", {
      id: "sub_123",
      customer: "cus_123",
      status: stripeStatus,
    })
    const res = await POST(webhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_123" },
      data: { subscriptionStatus: dbStatus, stripeSubscriptionId: "sub_123" },
    })
  })

  it("marks the org CANCELED on customer.subscription.deleted", async () => {
    stubEvent("customer.subscription.deleted", { customer: "cus_123" })
    await POST(webhookRequest())
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_123" },
      data: { subscriptionStatus: "CANCELED" },
    })
  })

  it("marks the org PAST_DUE on invoice.payment_failed", async () => {
    stubEvent("invoice.payment_failed", { customer: "cus_123" })
    await POST(webhookRequest())
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_123" },
      data: { subscriptionStatus: "PAST_DUE" },
    })
  })

  it("acknowledges unhandled event types without touching the DB", async () => {
    stubEvent("customer.created", {})
    const res = await POST(webhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })
})
