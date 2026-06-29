import type { SubscriptionStatus } from "@/types"

/** Days a PAST_DUE org keeps access (grace) before the paywall closes. */
export const PAST_DUE_GRACE_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The authoritative billing fields for one org. Sourced from the DB (which the
 * Stripe webhook keeps in sync) or from the JWT cache, which mirrors the same
 * fields. `trialEndsAt` / `pastDueSince` are fixed timestamps, so caching them
 * is NOT subject to staleness — only `status` can lag (bounded by token maxAge).
 */
export type BillingSnapshot = {
  status: SubscriptionStatus
  trialEndsAt: Date | null
  pastDueSince: Date | null
}

export type BillingBlockCode =
  | "TRIAL_EXPIRED"
  | "PAST_DUE_EXPIRED"
  | "SUBSCRIPTION_CANCELED"

export type BillingBlock = {
  code: BillingBlockCode
  message: string
}

/**
 * Single source of truth for "may this org use paid features right now?".
 *
 * Pure + deterministic: the caller passes `now`, so the exact same logic runs on
 * the JWT fast path and the DB slow path and is trivially unit-testable.
 *
 * Returns `null` when access is allowed, or a {@link BillingBlock} (→ HTTP 402)
 * when it must be denied.
 */
export function canAccessOrg(
  billing: BillingSnapshot,
  now: Date = new Date(),
): BillingBlock | null {
  switch (billing.status) {
    case "ACTIVE":
      return null

    case "TRIALING":
      // A null trialEndsAt (legacy row not yet backfilled) is treated as an open
      // trial rather than an instant block — the migration backfills it.
      if (billing.trialEndsAt && billing.trialEndsAt.getTime() <= now.getTime()) {
        return { code: "TRIAL_EXPIRED", message: "Your free trial has ended" }
      }
      return null

    case "PAST_DUE": {
      // Grace is anchored to the FIRST failed payment. If unknown, anchor to now
      // so a missing timestamp grants (never denies) the bounded grace window —
      // fail-open within grace, never indefinitely.
      const graceStart = billing.pastDueSince ?? now
      const graceEnds = graceStart.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS
      if (now.getTime() >= graceEnds) {
        return { code: "PAST_DUE_EXPIRED", message: "Payment is overdue" }
      }
      return null
    }

    case "CANCELED":
      return { code: "SUBSCRIPTION_CANCELED", message: "Subscription cancelled" }

    default:
      // Unknown / undefined status — fail closed.
      return { code: "SUBSCRIPTION_CANCELED", message: "Subscription inactive" }
  }
}
