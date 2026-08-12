/**
 * Stripe webhook handler tests — signature rejection, idempotency, the
 * non-regressive ordering guard, the Stripe-status → SubscriptionStatus mapping,
 * the customer-hijack guard, and PAST_DUE grace anchoring.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { stripe } from "@/lib/stripe"
import { db } from "@/lib/prisma"
import { POST } from "@/app/api/webhooks/stripe/route"

vi.mock("@/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: vi.fn() } },
}))

// `$transaction` runs the callback against the same mock client, so the
// assertions below still see db.organization.* calls. Rollback itself is not
// simulated — a mock cannot undo a write — so what these tests pin is the HTTP
// answer, which is what actually decides whether Stripe retries, plus the fact
// that the handler groups its writes in a transaction at all.
vi.mock("@/lib/prisma", () => {
  const client = {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    processedStripeEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  client.$transaction.mockImplementation(async (fn: (tx: typeof client) => unknown) => fn(client))
  return { db: client }
})

/** A Prisma unique-constraint violation, as the client actually surfaces it. */
function uniqueViolation() {
  return Object.assign(new Error("Unique constraint failed on the fields: (`id`)"), {
    code: "P2002",
  })
}

const mockConstructEvent = vi.mocked(stripe.webhooks.constructEvent)
const mockFindUnique = vi.mocked(db.organization.findUnique)
const mockUpdateMany = vi.mocked(db.organization.updateMany)
const mockEventCreate = vi.mocked(db.processedStripeEvent.create)

// Fixed event time used throughout (epoch seconds).
const EVENT_CREATED = Math.floor(new Date("2026-06-13T12:00:00.000Z").getTime() / 1000)
const EVENT_TIME = new Date(EVENT_CREATED * 1000)

function webhookRequest(withSignature = true) {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: "raw-payload",
    headers: withSignature ? { "stripe-signature": "sig_test" } : {},
  })
}

let eventCounter = 0
function stubEvent(type: string, object: Record<string, unknown>, created = EVENT_CREATED) {
  mockConstructEvent.mockReturnValue({
    id: `evt_${++eventCounter}`,
    type,
    created,
    data: { object },
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: event id is new (idempotency ledger insert succeeds).
  mockEventCreate.mockResolvedValue({} as never)
  mockUpdateMany.mockResolvedValue({ count: 1 } as never)
})

describe("signature verification", () => {
  it("rejects requests without a stripe-signature header", async () => {
    const res = await POST(webhookRequest(false))
    expect(res.status).toBe(400)
    expect(mockConstructEvent).not.toHaveBeenCalled()
    expect(mockEventCreate).not.toHaveBeenCalled()
  })

  it("rejects requests with an invalid signature", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("bad signature")
    })
    const res = await POST(webhookRequest())
    expect(res.status).toBe(400)
    expect(mockEventCreate).not.toHaveBeenCalled()
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })
})

describe("idempotency", () => {
  it("processes a new event and records its id", async () => {
    stubEvent("invoice.payment_failed", { customer: "cus_123" })
    const res = await POST(webhookRequest())
    expect(res.status).toBe(200)
    expect(mockEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "invoice.payment_failed" }) }),
    )
    expect(mockUpdateMany).toHaveBeenCalled()
    // The ledger insert and the state change must share one transaction.
    expect(vi.mocked(db.$transaction)).toHaveBeenCalled()
  })

  it("skips a duplicate delivery without touching org state", async () => {
    stubEvent("invoice.payment_failed", { customer: "cus_123" })
    // Primary-key violation → already processed.
    mockEventCreate.mockRejectedValue(uniqueViolation())
    const res = await POST(webhookRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ duplicate: true })
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  // The regression this handler was rewritten for: recording the event id and
  // then failing used to answer 200-duplicate on Stripe's retry, so the status
  // change was dropped for good. A failure must surface as 5xx and stay
  // retryable, and the retry must actually apply the change.
  it("answers 5xx when processing fails, so Stripe retries", async () => {
    stubEvent("invoice.payment_failed", { customer: "cus_123" })
    mockUpdateMany.mockRejectedValueOnce(new Error("Connection terminated unexpectedly"))

    const res = await POST(webhookRequest())
    expect(res.status).toBe(500)
    expect(await res.json()).not.toMatchObject({ duplicate: true })
  })

  it("applies the status when a failed delivery is retried", async () => {
    // Same event id twice: the ledger insert is rolled back with the failure, so
    // the retry is NOT seen as a duplicate.
    mockConstructEvent.mockReturnValue({
      id: "evt_retry",
      type: "invoice.payment_failed",
      created: EVENT_CREATED,
      data: { object: { customer: "cus_123" } },
    } as never)

    mockUpdateMany.mockRejectedValueOnce(new Error("Connection terminated unexpectedly"))
    expect((await POST(webhookRequest())).status).toBe(500)

    mockUpdateMany.mockResolvedValue({ count: 1 } as never)
    const retry = await POST(webhookRequest())
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ received: true })
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: "PAST_DUE" }) }),
    )
  })

  // A connection failure on the ledger insert is not evidence the event was
  // already handled; calling it a duplicate would lose the event exactly as before.
  it("does not treat a non-unique insert error as a duplicate", async () => {
    stubEvent("invoice.payment_failed", { customer: "cus_123" })
    mockEventCreate.mockRejectedValue(new Error("Connection terminated unexpectedly"))

    const res = await POST(webhookRequest())
    expect(res.status).toBe(500)
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

  it("activates the org, stores ids, clears grace, and stamps the event time", async () => {
    stubEvent("checkout.session.completed", session)
    mockFindUnique.mockResolvedValue({ stripeCustomerId: null } as never)

    const res = await POST(webhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "org1",
        OR: [{ stripeEventAt: null }, { stripeEventAt: { lte: EVENT_TIME } }],
      },
      data: {
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        subscriptionStatus: "ACTIVE",
        pastDueSince: null,
        stripeEventAt: EVENT_TIME,
      },
    })
  })

  it("rejects a customer mismatch (billing hijack guard)", async () => {
    stubEvent("checkout.session.completed", session)
    mockFindUnique.mockResolvedValue({ stripeCustomerId: "cus_SOMEONE_ELSE" } as never)

    const res = await POST(webhookRequest())
    expect(res.status).toBe(400)
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it("ignores sessions without org metadata", async () => {
    stubEvent("checkout.session.completed", { ...session, metadata: {} })
    const res = await POST(webhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpdateMany).not.toHaveBeenCalled()
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
    // The status-applying updateMany carries the ordering guard + event stamp.
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          stripeCustomerId: "cus_123",
          OR: [{ stripeEventAt: null }, { stripeEventAt: { lte: EVENT_TIME } }],
        }),
        data: expect.objectContaining({
          subscriptionStatus: dbStatus,
          stripeSubscriptionId: "sub_123",
          stripeEventAt: EVENT_TIME,
        }),
      }),
    )
  })

  it("clears the grace clock when a subscription recovers to active", async () => {
    stubEvent("customer.subscription.updated", { id: "sub_123", customer: "cus_123", status: "active" })
    await POST(webhookRequest())
    const statusCall = mockUpdateMany.mock.calls.find(
      ([arg]) => (arg as { data?: { subscriptionStatus?: string } }).data?.subscriptionStatus === "ACTIVE",
    )
    expect(statusCall?.[0]).toMatchObject({ data: { pastDueSince: null } })
  })

  it("marks the org CANCELED on customer.subscription.deleted", async () => {
    stubEvent("customer.subscription.deleted", { id: "sub_123", customer: "cus_123" })
    await POST(webhookRequest())
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: "CANCELED" }) }),
    )
  })

  it("anchors pastDueSince to the first failure on invoice.payment_failed", async () => {
    stubEvent("invoice.payment_failed", { customer: "cus_123" })
    await POST(webhookRequest())
    // First updateMany only sets pastDueSince where it is still null.
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_123", pastDueSince: null },
      data: { pastDueSince: EVENT_TIME },
    })
    // Then the status is applied.
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: "PAST_DUE" }) }),
    )
  })

  it("acknowledges unhandled event types without touching org state", async () => {
    stubEvent("customer.created", {})
    const res = await POST(webhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })
})
