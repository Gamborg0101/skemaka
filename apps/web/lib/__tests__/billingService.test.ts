/**
 * Seat licensing — the money-moving half.
 *
 * The Stripe subscription quantity mirrors PURCHASED seats, not active
 * employees. Increases are immediate and billed as one flat month per seat;
 * decreases are scheduled for the next period and never refunded. Getting the
 * proration_behavior wrong here silently over- or under-charges every customer,
 * so the Stripe call shapes are asserted explicitly.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import {
  syncSubscriptionQuantity,
  syncSubscriptionQuantitySafe,
  checkoutSeatCount,
  changeSeats,
  applyPendingSeats,
} from "@/lib/services/billingService"
import { ServiceError } from "@/lib/services/errors"

vi.mock("@/lib/prisma", () => ({
  db: {
    organization: { findUnique: vi.fn(), update: vi.fn() },
    employee: { count: vi.fn() },
  },
}))

vi.mock("@/lib/stripe", () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn() },
    subscriptionItems: { update: vi.fn() },
    invoiceItems: { create: vi.fn() },
  },
}))

const orgFind = vi.mocked(db.organization.findUnique)
const orgUpdate = vi.mocked(db.organization.update)
const empCount = vi.mocked(db.employee.count)
const subRetrieve = vi.mocked(stripe.subscriptions.retrieve)
const itemUpdate = vi.mocked(stripe.subscriptionItems.update)
const invoiceItemCreate = vi.mocked(stripe.invoiceItems.create)

const HOUR = 3600
const PERIOD_END = Math.floor(Date.now() / 1000) + 24 * HOUR

function stubSubscription(quantity: number, periodEnd = PERIOD_END) {
  subRetrieve.mockResolvedValue({
    items: { data: [{ id: "si_1", quantity, current_period_end: periodEnd }] },
  } as never)
}

/** The org row `changeSeats` reads before deciding. */
function stubOrg(o: Partial<{ seats: number; pendingSeats: number | null; sub: string | null; cust: string | null }>) {
  orgFind.mockResolvedValue({
    seats: o.seats ?? 5,
    pendingSeats: o.pendingSeats ?? null,
    stripeSubscriptionId: o.sub === undefined ? "sub_1" : o.sub,
    stripeCustomerId: o.cust === undefined ? "cus_1" : o.cust,
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  orgUpdate.mockResolvedValue({ seats: 5, pendingSeats: null } as never)
  empCount.mockResolvedValue(0)
})

describe("checkoutSeatCount", () => {
  it("uses what the manager asked for", async () => {
    orgFind.mockResolvedValue({ seats: 5 } as never)
    empCount.mockResolvedValue(2)
    expect(await checkoutSeatCount("org1", 12)).toBe(12)
  })

  it("never lets a trial check out with fewer seats than it has people", async () => {
    // A trial adds employees freely; at checkout the bill must cover them.
    orgFind.mockResolvedValue({ seats: 5 } as never)
    empCount.mockResolvedValue(9)
    expect(await checkoutSeatCount("org1", 6)).toBe(9)
  })

  it("floors at the base allowance", async () => {
    orgFind.mockResolvedValue({ seats: 5 } as never)
    empCount.mockResolvedValue(1)
    expect(await checkoutSeatCount("org1", 2)).toBe(5)
  })

  it("falls back to the org's stored seats when none is requested", async () => {
    orgFind.mockResolvedValue({ seats: 11 } as never)
    empCount.mockResolvedValue(3)
    expect(await checkoutSeatCount("org1")).toBe(11)
  })
})

describe("changeSeats — increases", () => {
  it("applies immediately and bills a flat month per added seat", async () => {
    stubOrg({ seats: 5 })
    stubSubscription(5)
    const res = await changeSeats("org1", 8)

    expect(res.effective).toBe("immediately")
    expect(res.seats).toBe(8)
    // 3 seats × €3.50 = €10.50
    expect(res.chargedNow).toBe(1050)
    expect(invoiceItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_1", amount: 1050, currency: "eur" }),
    )
  })

  it("does NOT let Stripe prorate as well — that would bill twice", async () => {
    stubOrg({ seats: 5 })
    stubSubscription(5)
    await changeSeats("org1", 6)
    expect(itemUpdate).toHaveBeenCalledWith("si_1", {
      quantity: 6,
      proration_behavior: "none",
    })
  })

  it("charges exactly the per-seat rate at the base boundary", async () => {
    // Under the graduated price the 6th seat costs the same as the 60th.
    stubOrg({ seats: 5 })
    stubSubscription(5)
    const res = await changeSeats("org1", 6)
    expect(res.chargedNow).toBe(350)
  })

  it("supersedes a scheduled reduction", async () => {
    stubOrg({ seats: 10, pendingSeats: 6 })
    stubSubscription(6)
    const res = await changeSeats("org1", 12)
    expect(res.pendingSeats).toBeNull()
    expect(orgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { seats: 12, pendingSeats: null, pendingSeatsEffectiveAt: null },
      }),
    )
  })
})

describe("changeSeats — reductions", () => {
  it("schedules for the end of the paid period rather than applying now", async () => {
    stubOrg({ seats: 10 })
    stubSubscription(10)
    orgUpdate.mockResolvedValue({ seats: 10, pendingSeats: 6 } as never)

    const res = await changeSeats("org1", 6)

    expect(res.effective).toBe("next_period")
    // Still holding — and still paying for — the seats bought this period.
    expect(res.seats).toBe(10)
    expect(res.pendingSeats).toBe(6)
    expect(res.chargedNow).toBe(0)
  })

  it("drops the Stripe quantity with no proration — no refund, no credit", async () => {
    stubOrg({ seats: 10 })
    stubSubscription(10)
    orgUpdate.mockResolvedValue({ seats: 10, pendingSeats: 6 } as never)
    await changeSeats("org1", 6)
    expect(itemUpdate).toHaveBeenCalledWith("si_1", {
      quantity: 6,
      proration_behavior: "none",
    })
  })

  it("records when the reduction becomes effective", async () => {
    stubOrg({ seats: 10 })
    stubSubscription(10)
    orgUpdate.mockResolvedValue({ seats: 10, pendingSeats: 6 } as never)
    await changeSeats("org1", 6)

    const data = orgUpdate.mock.calls[0][0].data as { pendingSeatsEffectiveAt: Date }
    expect(data.pendingSeatsEffectiveAt.getTime()).toBe(PERIOD_END * 1000)
  })

  it("refuses to strand active employees without a seat", async () => {
    stubOrg({ seats: 10 })
    empCount.mockResolvedValue(9)
    await changeSeats("org1", 6).catch((err: ServiceError) => {
      expect(err.code).toBe("CONFLICT")
      // The message must name the number to deactivate — this is the whole UX.
      expect(err.message).toContain("9 active")
      expect(err.message).toContain("Deactivate 3")
    })
    expect.assertions(3)
  })

  it("refuses to go below the base allowance", async () => {
    stubOrg({ seats: 10 })
    await changeSeats("org1", 4).catch((err: ServiceError) => {
      expect(err.code).toBe("BAD_REQUEST")
    })
    expect.assertions(1)
  })

  it("rejects a fractional seat count", async () => {
    stubOrg({ seats: 10 })
    await changeSeats("org1", 6.5).catch((err: ServiceError) => {
      expect(err.code).toBe("BAD_REQUEST")
    })
    expect.assertions(1)
  })
})

describe("changeSeats — no-op", () => {
  it("cancels a scheduled reduction when set back to the current count", async () => {
    stubOrg({ seats: 10, pendingSeats: 6 })
    stubSubscription(6)
    orgFind
      .mockResolvedValueOnce({
        seats: 10, pendingSeats: 6, stripeSubscriptionId: "sub_1", stripeCustomerId: "cus_1",
      } as never)
      .mockResolvedValueOnce({ stripeSubscriptionId: "sub_1", seats: 10 } as never)

    const res = await changeSeats("org1", 10)
    expect(res.pendingSeats).toBeNull()
    // …and the Stripe quantity goes back up to what they still hold.
    expect(itemUpdate).toHaveBeenCalledWith("si_1", { quantity: 10, proration_behavior: "none" })
  })
})

describe("applyPendingSeats", () => {
  it("applies a due reduction", async () => {
    orgFind.mockResolvedValue({
      pendingSeats: 6,
      pendingSeatsEffectiveAt: new Date(Date.now() - 1000),
    } as never)
    await applyPendingSeats("org1")
    expect(orgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { seats: 6, pendingSeats: null, pendingSeatsEffectiveAt: null },
      }),
    )
  })

  it("leaves a reduction alone until its period ends", async () => {
    orgFind.mockResolvedValue({
      pendingSeats: 6,
      pendingSeatsEffectiveAt: new Date(Date.now() + 60_000),
    } as never)
    await applyPendingSeats("org1")
    expect(orgUpdate).not.toHaveBeenCalled()
  })

  it("does nothing when nothing is scheduled", async () => {
    orgFind.mockResolvedValue({ pendingSeats: null, pendingSeatsEffectiveAt: null } as never)
    await applyPendingSeats("org1")
    expect(orgUpdate).not.toHaveBeenCalled()
  })
})

describe("syncSubscriptionQuantity", () => {
  it("does nothing for orgs without a subscription (trialing)", async () => {
    orgFind.mockResolvedValue({ stripeSubscriptionId: null, seats: 5 } as never)
    await syncSubscriptionQuantity("org1")
    expect(subRetrieve).not.toHaveBeenCalled()
    expect(itemUpdate).not.toHaveBeenCalled()
  })

  it("syncs to PURCHASED seats, not the employee count", async () => {
    orgFind.mockResolvedValue({ stripeSubscriptionId: "sub_1", seats: 12 } as never)
    empCount.mockResolvedValue(3) // deliberately different — must be ignored
    stubSubscription(5)
    await syncSubscriptionQuantity("org1")
    expect(itemUpdate).toHaveBeenCalledWith("si_1", {
      quantity: 12,
      proration_behavior: "none",
    })
  })

  it("never invoices while repairing drift", async () => {
    orgFind.mockResolvedValue({ stripeSubscriptionId: "sub_1", seats: 9 } as never)
    stubSubscription(4)
    await syncSubscriptionQuantity("org1")
    expect(invoiceItemCreate).not.toHaveBeenCalled()
  })

  it("skips the Stripe write when already in sync", async () => {
    orgFind.mockResolvedValue({ stripeSubscriptionId: "sub_1", seats: 3 } as never)
    stubSubscription(3)
    await syncSubscriptionQuantity("org1")
    expect(itemUpdate).not.toHaveBeenCalled()
  })
})

describe("syncSubscriptionQuantitySafe", () => {
  it("swallows Stripe failures so the caller never breaks", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    orgFind.mockResolvedValue({ stripeSubscriptionId: "sub_1", seats: 5 } as never)
    subRetrieve.mockRejectedValue(new Error("stripe down"))

    expect(() => syncSubscriptionQuantitySafe("org1")).not.toThrow()
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalled())
    consoleError.mockRestore()
  })
})
