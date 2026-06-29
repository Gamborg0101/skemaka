import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { db } from "@/lib/prisma"
import { SubscriptionStatus } from "@/app/generated/prisma/enums"
import type Stripe from "stripe"
import { logError, requestIdFrom } from "@/lib/log"

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: SubscriptionStatus.ACTIVE,
  trialing: SubscriptionStatus.TRIALING,
  past_due: SubscriptionStatus.PAST_DUE,
  canceled: SubscriptionStatus.CANCELED,
  unpaid: SubscriptionStatus.PAST_DUE,
  paused: SubscriptionStatus.CANCELED,
  incomplete: SubscriptionStatus.PAST_DUE,
  incomplete_expired: SubscriptionStatus.CANCELED,
}

/**
 * Apply a subscription status to every org with this Stripe customer.
 *
 * Non-regressive: the update only lands when this event is at least as new as
 * the last one we applied (`stripeEventAt`), so a late/out-of-order delivery can
 * never overwrite newer state. `pastDueSince` is anchored to the FIRST failure
 * and cleared on recovery (ACTIVE/TRIALING).
 */
async function applyStatus(
  stripeCustomerId: string,
  status: SubscriptionStatus,
  subscriptionId: string | null,
  eventTime: Date,
): Promise<void> {
  // Anchor the grace clock to the first observed failure only (idempotent).
  if (status === SubscriptionStatus.PAST_DUE) {
    await db.organization.updateMany({
      where: { stripeCustomerId, pastDueSince: null },
      data: { pastDueSince: eventTime },
    })
  }

  const clearGrace =
    status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIALING

  await db.organization.updateMany({
    where: {
      stripeCustomerId,
      // Ordering guard: skip if a newer event already applied.
      OR: [{ stripeEventAt: null }, { stripeEventAt: { lte: eventTime } }],
    },
    data: {
      subscriptionStatus: status,
      stripeEventAt: eventTime,
      ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
      ...(clearGrace ? { pastDueSince: null } : {}),
    },
  })
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? "")
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 })
  }

  // ── Idempotency ────────────────────────────────────────────────────────────
  // Record the event id before doing any work. A replayed/duplicated delivery
  // hits the primary-key constraint and is acknowledged without re-processing.
  try {
    await db.processedStripeEvent.create({ data: { id: event.id, type: event.type } })
  } catch {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
  }

  // Stripe's event creation time drives the non-regression ordering guard.
  const eventTime = new Date(event.created * 1000)

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const organizationId = session.metadata?.organizationId
      if (!organizationId || session.mode !== "subscription") break

      const org = await db.organization.findUnique({
        where: { id: organizationId },
        select: { stripeCustomerId: true },
      })
      if (!org) break

      // If the org already has a customer ID, it must match what Stripe sent.
      // Prevents replayed or crafted events from hijacking another org's billing.
      if (org.stripeCustomerId && org.stripeCustomerId !== (session.customer as string)) {
        logError("stripe webhook", "customer mismatch for org", {
          organizationId,
          requestId: requestIdFrom(req.headers),
        })
        return NextResponse.json({ error: "Customer mismatch" }, { status: 400 })
      }

      await db.organization.updateMany({
        where: {
          id: organizationId,
          OR: [{ stripeEventAt: null }, { stripeEventAt: { lte: eventTime } }],
        },
        data: {
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          pastDueSince: null,
          stripeEventAt: eventTime,
        },
      })
      break
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription
      const status = STATUS_MAP[subscription.status] ?? SubscriptionStatus.ACTIVE
      await applyStatus(subscription.customer as string, status, subscription.id, eventTime)
      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription
      await applyStatus(
        subscription.customer as string,
        SubscriptionStatus.CANCELED,
        subscription.id,
        eventTime,
      )
      break
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      await applyStatus(invoice.customer as string, SubscriptionStatus.PAST_DUE, null, eventTime)
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
