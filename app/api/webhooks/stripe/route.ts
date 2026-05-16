import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { db } from "@/lib/prisma"
import { SubscriptionStatus } from "@/app/generated/prisma/enums"
import type Stripe from "stripe"

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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const organizationId = session.metadata?.organizationId
      if (!organizationId || session.mode !== "subscription") break

      await db.organization.update({
        where: { id: organizationId },
        data: {
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          subscriptionStatus: SubscriptionStatus.ACTIVE,
        },
      })
      break
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription
      const stripeCustomerId = subscription.customer as string
      const subscriptionStatus = STATUS_MAP[subscription.status] ?? SubscriptionStatus.ACTIVE

      await db.organization.updateMany({
        where: { stripeCustomerId },
        data: { subscriptionStatus, stripeSubscriptionId: subscription.id },
      })
      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription
      const stripeCustomerId = subscription.customer as string

      await db.organization.updateMany({
        where: { stripeCustomerId },
        data: { subscriptionStatus: SubscriptionStatus.CANCELED },
      })
      break
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      const stripeCustomerId = invoice.customer as string

      await db.organization.updateMany({
        where: { stripeCustomerId },
        data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
      })
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
