/**
 * Unit tests for the pure billing-access decision. This is the single source of
 * truth used by both the JWT fast path and the DB slow path in apiGuard, so the
 * full state matrix is exercised here.
 */
import { describe, it, expect } from "vitest"
import { canAccessOrg, PAST_DUE_GRACE_DAYS, type BillingSnapshot } from "@/lib/billing"

const NOW = new Date("2026-06-13T12:00:00.000Z")
const DAY = 24 * 60 * 60 * 1000

function snap(p: Partial<BillingSnapshot> & Pick<BillingSnapshot, "status">): BillingSnapshot {
  return { trialEndsAt: null, pastDueSince: null, ...p }
}

describe("canAccessOrg — ACTIVE", () => {
  it("always allows", () => {
    expect(canAccessOrg(snap({ status: "ACTIVE" }), NOW)).toBeNull()
  })
})

describe("canAccessOrg — TRIALING", () => {
  it("allows while the trial is in the future", () => {
    const trialEndsAt = new Date(NOW.getTime() + 5 * DAY)
    expect(canAccessOrg(snap({ status: "TRIALING", trialEndsAt }), NOW)).toBeNull()
  })

  it("blocks with TRIAL_EXPIRED once the trial end has passed", () => {
    const trialEndsAt = new Date(NOW.getTime() - 1)
    expect(canAccessOrg(snap({ status: "TRIALING", trialEndsAt }), NOW)).toMatchObject({
      code: "TRIAL_EXPIRED",
    })
  })

  it("blocks exactly at the trial boundary (<= is inclusive)", () => {
    expect(canAccessOrg(snap({ status: "TRIALING", trialEndsAt: NOW }), NOW)).toMatchObject({
      code: "TRIAL_EXPIRED",
    })
  })

  it("treats a null trialEndsAt (legacy row) as an open trial", () => {
    expect(canAccessOrg(snap({ status: "TRIALING", trialEndsAt: null }), NOW)).toBeNull()
  })
})

describe("canAccessOrg — PAST_DUE", () => {
  it("allows inside the grace window", () => {
    const pastDueSince = new Date(NOW.getTime() - (PAST_DUE_GRACE_DAYS - 1) * DAY)
    expect(canAccessOrg(snap({ status: "PAST_DUE", pastDueSince }), NOW)).toBeNull()
  })

  it("blocks with PAST_DUE_EXPIRED once grace has elapsed", () => {
    const pastDueSince = new Date(NOW.getTime() - (PAST_DUE_GRACE_DAYS + 1) * DAY)
    expect(canAccessOrg(snap({ status: "PAST_DUE", pastDueSince }), NOW)).toMatchObject({
      code: "PAST_DUE_EXPIRED",
    })
  })

  it("blocks exactly at the grace boundary", () => {
    const pastDueSince = new Date(NOW.getTime() - PAST_DUE_GRACE_DAYS * DAY)
    expect(canAccessOrg(snap({ status: "PAST_DUE", pastDueSince }), NOW)).toMatchObject({
      code: "PAST_DUE_EXPIRED",
    })
  })

  it("grants a full grace window when pastDueSince is unknown", () => {
    expect(canAccessOrg(snap({ status: "PAST_DUE", pastDueSince: null }), NOW)).toBeNull()
  })
})

describe("full subscription lifecycle", () => {
  it("trial → expiry → blocked → active → restored → past_due → grace → blocked", () => {
    const t0 = new Date("2026-06-01T00:00:00.000Z").getTime()
    const at = (days: number) => new Date(t0 + days * DAY)

    // 1. New org: 14-day trial. Day 3 → allowed.
    const trialEndsAt = at(14)
    expect(canAccessOrg(snap({ status: "TRIALING", trialEndsAt }), at(3))).toBeNull()

    // 2. Trial expires. Day 15 → blocked.
    expect(canAccessOrg(snap({ status: "TRIALING", trialEndsAt }), at(15))).toMatchObject({
      code: "TRIAL_EXPIRED",
    })

    // 3. Customer subscribes → ACTIVE. Day 16 → access restored.
    expect(canAccessOrg(snap({ status: "ACTIVE" }), at(16))).toBeNull()

    // 4. Payment fails → PAST_DUE, grace anchored at day 30. Day 35 (within 14d) → allowed.
    const pastDueSince = at(30)
    expect(canAccessOrg(snap({ status: "PAST_DUE", pastDueSince }), at(35))).toBeNull()

    // 5. Grace elapses. Day 45 (>14d after failure) → blocked.
    expect(canAccessOrg(snap({ status: "PAST_DUE", pastDueSince }), at(45))).toMatchObject({
      code: "PAST_DUE_EXPIRED",
    })

    // 6. Dunning fails entirely → CANCELED. Always blocked.
    expect(canAccessOrg(snap({ status: "CANCELED" }), at(46))).toMatchObject({
      code: "SUBSCRIPTION_CANCELED",
    })
  })
})

describe("canAccessOrg — CANCELED / unknown", () => {
  it("blocks CANCELED with SUBSCRIPTION_CANCELED", () => {
    expect(canAccessOrg(snap({ status: "CANCELED" }), NOW)).toMatchObject({
      code: "SUBSCRIPTION_CANCELED",
    })
  })

  it("fails closed on an unknown status", () => {
    expect(canAccessOrg(snap({ status: "BOGUS" as never }), NOW)).toMatchObject({
      code: "SUBSCRIPTION_CANCELED",
    })
  })
})
