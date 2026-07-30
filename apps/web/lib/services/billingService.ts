import { db } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { ServiceError } from "./errors"
import { MIN_SEATS, minimumSeatsFor } from "./seats"
import { PRICE_PER_EMPLOYEE_MONTHLY } from "@/lib/pricing"

/**
 * Seat licensing.
 *
 * The Stripe subscription quantity mirrors `Organization.seats` — the seats the
 * org has BOUGHT — not how many employees happen to be active. Employee CRUD no
 * longer touches billing at all; only an explicit seat change does.
 *
 * Increases apply immediately: the manager needs the seat now. The added seats
 * are charged as one flat month each rather than a time-weighted proration —
 * simpler to explain, and under the graduated price exactly right, because every
 * seat above the base costs the same €3.50 wherever it sits.
 *
 * Decreases never apply mid-cycle. They land in `pendingSeats` and replace
 * `seats` when the period rolls over, so the org keeps — and pays for — what it
 * bought until the end of the month it bought it. No refunds, no credits.
 */

/** Sync the Stripe subscription quantity to the org's purchased seats. */
export async function syncSubscriptionQuantity(orgId: string): Promise<void> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { stripeSubscriptionId: true, seats: true },
  })
  if (!org?.stripeSubscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId)
  const item = subscription.items.data[0]
  if (!item || item.quantity === org.seats) return

  await stripe.subscriptionItems.update(item.id, {
    quantity: org.seats,
    // The seat-change flows below handle money explicitly. This path exists only
    // to repair drift and must never quietly invoice for it.
    proration_behavior: "none",
  })
}

/**
 * Seats to subscribe with at checkout: what the manager chose, floored at the
 * base allowance and at however many employees are already active. A trial org
 * adds staff freely, so it cannot check out with fewer seats than people.
 */
export async function checkoutSeatCount(orgId: string, requested?: number): Promise<number> {
  const [org, active] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId }, select: { seats: true } }),
    db.employee.count({ where: { organizationId: orgId, isActive: true } }),
  ])
  return Math.max(minimumSeatsFor(active), requested ?? org?.seats ?? MIN_SEATS)
}

export interface SeatChangeResult {
  seats: number
  pendingSeats: number | null
  /** Cents billed for the added seats' remaining month. Increases only. */
  chargedNow: number
  effective: "immediately" | "next_period"
}

type OrgBilling = {
  seats: number
  pendingSeats: number | null
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
}

/**
 * Change an org's seat count. Routes to an immediate increase or a scheduled
 * reduction; setting it back to the current value cancels a pending reduction.
 */
export async function changeSeats(orgId: string, newSeats: number): Promise<SeatChangeResult> {
  if (!Number.isInteger(newSeats)) {
    throw new ServiceError("Seat count must be a whole number", "BAD_REQUEST")
  }

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { seats: true, pendingSeats: true, stripeSubscriptionId: true, stripeCustomerId: true },
  })
  if (!org) throw new ServiceError("Organization not found", "NOT_FOUND")

  const active = await db.employee.count({ where: { organizationId: orgId, isActive: true } })

  if (newSeats < MIN_SEATS) {
    throw new ServiceError(`Plans start at ${MIN_SEATS} seats.`, "BAD_REQUEST")
  }
  if (newSeats < minimumSeatsFor(active)) {
    // Never auto-deactivate to make room. Removing someone's staff is the
    // manager's decision, never something we do on their behalf.
    const excess = active - newSeats
    throw new ServiceError(
      `You have ${active} active team members. Deactivate ${excess} of them before reducing to ${newSeats} seats.`,
      "CONFLICT",
    )
  }

  if (newSeats === org.seats) {
    if (org.pendingSeats !== null) {
      await db.organization.update({
        where: { id: orgId },
        data: { pendingSeats: null, pendingSeatsEffectiveAt: null },
      })
      await syncSubscriptionQuantity(orgId)
    }
    return { seats: org.seats, pendingSeats: null, chargedNow: 0, effective: "immediately" }
  }

  return newSeats > org.seats
    ? increaseSeats(orgId, org, newSeats)
    : scheduleSeatReduction(orgId, org, newSeats)
}

/**
 * Increase seats. Usable immediately; the added seats are billed as one flat
 * month each (€3.50 apiece) as a line item on the next invoice, after which they
 * are simply part of the normal monthly charge.
 */
async function increaseSeats(
  orgId: string,
  org: OrgBilling,
  newSeats: number,
): Promise<SeatChangeResult> {
  const added = newSeats - org.seats
  const chargedNow = Math.round(added * PRICE_PER_EMPLOYEE_MONTHLY * 100)

  await db.organization.update({
    where: { id: orgId },
    // An increase supersedes any scheduled reduction.
    data: { seats: newSeats, pendingSeats: null, pendingSeatsEffectiveAt: null },
  })

  if (org.stripeSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId)
    const item = subscription.items.data[0]
    if (item) {
      await stripe.subscriptionItems.update(item.id, {
        quantity: newSeats,
        // We bill the part-month ourselves below; letting Stripe prorate as well
        // would charge for the same seats twice.
        proration_behavior: "none",
      })
    }
    if (org.stripeCustomerId && chargedNow > 0) {
      await stripe.invoiceItems.create({
        customer: org.stripeCustomerId,
        amount: chargedNow,
        currency: "eur",
        description: `${added} additional seat${added > 1 ? "s" : ""} — remainder of current month`,
      })
    }
  }

  return { seats: newSeats, pendingSeats: null, chargedNow, effective: "immediately" }
}

/**
 * Schedule a reduction for the next billing period. `seats` is untouched so the
 * org keeps the capacity it already paid for; the Stripe quantity drops with no
 * proration, so the NEXT invoice bills the lower number and nothing is credited.
 */
async function scheduleSeatReduction(
  orgId: string,
  org: OrgBilling,
  newSeats: number,
): Promise<SeatChangeResult> {
  // Effective when the period the org already paid for ends. Without a
  // subscription (a trial reducing its planned seats) there is nothing paid for,
  // so it takes effect at once.
  let effectiveAt = new Date()

  if (org.stripeSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId)
    const item = subscription.items.data[0]
    const periodEnd = item?.current_period_end ?? null
    if (periodEnd) effectiveAt = new Date(periodEnd * 1000)

    if (item && item.quantity !== newSeats) {
      await stripe.subscriptionItems.update(item.id, {
        quantity: newSeats,
        // No refund and no credit — the current period was bought in full.
        proration_behavior: "none",
      })
    }
  }

  const updated = await db.organization.update({
    where: { id: orgId },
    data: { pendingSeats: newSeats, pendingSeatsEffectiveAt: effectiveAt },
    select: { seats: true, pendingSeats: true },
  })

  return {
    seats: updated.seats,
    pendingSeats: updated.pendingSeats,
    chargedNow: 0,
    effective: effectiveAt <= new Date() ? "immediately" : "next_period",
  }
}

/**
 * Apply a scheduled reduction. Called when a new billing period begins — the
 * moment the org stops paying for the seats it gave up is the moment it stops
 * holding them.
 */
export async function applyPendingSeats(orgId: string): Promise<void> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { pendingSeats: true, pendingSeatsEffectiveAt: true },
  })
  if (!org || org.pendingSeats === null) return
  // Not due yet — the org still holds (and has paid for) its current seats.
  if (org.pendingSeatsEffectiveAt && org.pendingSeatsEffectiveAt > new Date()) return

  await db.organization.update({
    where: { id: orgId },
    data: { seats: org.pendingSeats, pendingSeats: null, pendingSeatsEffectiveAt: null },
  })
}

/**
 * Fire-and-forget wrapper: a Stripe outage must never fail the caller. Failures
 * are logged and repaired by the next successful sync.
 */
export function syncSubscriptionQuantitySafe(orgId: string): void {
  syncSubscriptionQuantity(orgId).catch((err) =>
    console.error("[billing] subscription quantity sync failed for org", orgId, err),
  )
}

/**
 * Cancel a Stripe subscription so a deleted org stops billing immediately.
 * Best-effort: a Stripe outage must not block account/org deletion — we log and
 * return false so the caller can proceed. No-op for a null id (trialing orgs).
 */
export async function cancelSubscriptionSafe(subscriptionId: string | null): Promise<boolean> {
  if (!subscriptionId) return true
  try {
    await stripe.subscriptions.cancel(subscriptionId)
    return true
  } catch (err) {
    console.error("[billing] failed to cancel subscription", subscriptionId, err)
    return false
  }
}
