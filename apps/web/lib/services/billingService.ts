import { db } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

/**
 * Pricing is per active employee per month. Keep the Stripe subscription item
 * quantity in lockstep with the org's active-employee count.
 *
 * No-op when the org has no subscription yet (trialing orgs subscribe via
 * checkout, which computes its own initial quantity).
 */
export async function syncSubscriptionQuantity(orgId: string): Promise<void> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { stripeSubscriptionId: true },
  })
  if (!org?.stripeSubscriptionId) return

  const quantity = await activeSeatCount(orgId)

  const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId)
  const item = subscription.items.data[0]
  if (!item || item.quantity === quantity) return

  await stripe.subscriptionItems.update(item.id, {
    quantity,
    proration_behavior: "create_prorations",
  })
}

/**
 * Billable seats = active employees, floored at 1 so a subscribed org with
 * zero active employees keeps a valid subscription instead of a 0-quantity one.
 */
export async function activeSeatCount(orgId: string): Promise<number> {
  const count = await db.employee.count({
    where: { organizationId: orgId, isActive: true },
  })
  return Math.max(1, count)
}

/**
 * Fire-and-forget wrapper for employee CRUD paths: a Stripe outage must never
 * fail the employee operation itself. Failures are logged and self-heal on the
 * next employee change.
 */
export function syncSubscriptionQuantitySafe(orgId: string): void {
  syncSubscriptionQuantity(orgId).catch((err) =>
    console.error("[billing] subscription quantity sync failed for org", orgId, err),
  )
}
