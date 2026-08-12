import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { db } from "@/lib/prisma"
import { SubscriptionStatus } from "@/app/generated/prisma/enums"
import type { Prisma } from "@/app/generated/prisma/client"
import type Stripe from "stripe"
import { logError, requestIdFrom } from "@/lib/log"

type Tx = Prisma.TransactionClient

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

/** Thrown to roll back the transaction when the event was already processed. */
class DuplicateEvent extends Error {}

/** Thrown to roll back the transaction on a billing-hijack attempt (→ 400). */
class CustomerMismatch extends Error {}

/** True for a Prisma unique-constraint violation, whatever the client wraps it in. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002"
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
  tx: Tx,
  stripeCustomerId: string,
  status: SubscriptionStatus,
  subscriptionId: string | null,
  eventTime: Date,
): Promise<void> {
  // Anchor the grace clock to the first observed failure only (idempotent).
  if (status === SubscriptionStatus.PAST_DUE) {
    await tx.organization.updateMany({
      where: { stripeCustomerId, pastDueSince: null },
      data: { pastDueSince: eventTime },
    })
  }

  const clearGrace =
    status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIALING

  await tx.organization.updateMany({
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

/** Apply one Stripe event to org billing state. Unknown types are a no-op. */
async function applyEvent(
  tx: Tx,
  event: Stripe.Event,
  eventTime: Date,
  requestId: string | undefined,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const organizationId = session.metadata?.organizationId
      if (!organizationId || session.mode !== "subscription") return

      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { stripeCustomerId: true },
      })
      if (!org) return

      // If the org already has a customer ID, it must match what Stripe sent.
      // Prevents replayed or crafted events from hijacking another org's billing.
      if (org.stripeCustomerId && org.stripeCustomerId !== (session.customer as string)) {
        logError("stripe webhook", "customer mismatch for org", { organizationId, requestId })
        throw new CustomerMismatch()
      }

      await tx.organization.updateMany({
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
      return
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription
      const status = STATUS_MAP[subscription.status] ?? SubscriptionStatus.ACTIVE
      await applyStatus(tx, subscription.customer as string, status, subscription.id, eventTime)
      return
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription
      await applyStatus(
        tx,
        subscription.customer as string,
        SubscriptionStatus.CANCELED,
        subscription.id,
        eventTime,
      )
      return
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      await applyStatus(tx, invoice.customer as string, SubscriptionStatus.PAST_DUE, null, eventTime)
      return
    }

    default:
      return
  }
}

export async function POST(req: NextRequest) {
  const requestId = requestIdFrom(req.headers)
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

  // Stripe's event creation time drives the non-regression ordering guard.
  const eventTime = new Date(event.created * 1000)

  // ── Idempotency, atomically ────────────────────────────────────────────────
  // The event id and the state change it causes are written in ONE transaction.
  //
  // Recording the id first and processing afterwards — which is what this did —
  // loses events: if processing threw (a Neon cold start is enough), the id was
  // already committed, so Stripe's retry collided with it and got a cheerful
  // `200 duplicate` for work that never happened. The org silently kept the
  // wrong subscription status, and nothing in the logs said so.
  //
  // Inside the transaction, a real duplicate still short-circuits on the primary
  // key, but a mid-processing failure rolls the id back with the change, so the
  // retry reprocesses from scratch. Only a P2002 counts as "already processed":
  // treating any insert error as a duplicate would reopen the same hole for
  // connection failures.
  try {
    await db.$transaction(
      async (tx) => {
        try {
          await tx.processedStripeEvent.create({ data: { id: event.id, type: event.type } })
        } catch (err) {
          if (isUniqueViolation(err)) throw new DuplicateEvent()
          throw err
        }
        await applyEvent(tx, event, eventTime, requestId)
      },
      // A cold start must not burn the default 5 s budget and roll back work
      // that would otherwise have succeeded; a retry is cheap but not free.
      { timeout: 15_000 },
    )
  } catch (err) {
    if (err instanceof DuplicateEvent) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
    }
    if (err instanceof CustomerMismatch) {
      return NextResponse.json({ error: "Customer mismatch" }, { status: 400 })
    }
    // Nothing was committed. Answer 5xx so Stripe retries — never 200.
    logError("stripe webhook", err, { requestId, eventId: event.id, eventType: event.type })
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
