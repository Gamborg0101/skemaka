import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import type Stripe from "stripe"

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
    case "customer.subscription.created": {
      const subscription = event.data.object as Stripe.Subscription
      const stripeSubscriptionId = subscription.id
      const stripeCustomerId = subscription.customer as string
      const status = subscription.status

      // TODO: update Organization in DB
      // await db.organization.update({
      //   where: { stripeCustomerId },
      //   data: {
      //     stripeSubscriptionId,
      //     subscriptionStatus: status === "trialing" ? "TRIALING" : "ACTIVE",
      //   },
      // })

      void stripeSubscriptionId
      void stripeCustomerId
      void status
      break
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription
      const stripeCustomerId = subscription.customer as string

      const statusMap: Record<string, string> = {
        active: "ACTIVE",
        trialing: "TRIALING",
        past_due: "PAST_DUE",
        canceled: "CANCELED",
        unpaid: "PAST_DUE",
        paused: "CANCELED",
        incomplete: "PAST_DUE",
        incomplete_expired: "CANCELED",
      }
      const subscriptionStatus = statusMap[subscription.status] ?? "ACTIVE"

      // TODO: update Organization in DB
      // await db.organization.update({
      //   where: { stripeCustomerId },
      //   data: { subscriptionStatus },
      // })

      void stripeCustomerId
      void subscriptionStatus
      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription
      const stripeCustomerId = subscription.customer as string

      // TODO: update Organization in DB
      // await db.organization.update({
      //   where: { stripeCustomerId },
      //   data: { subscriptionStatus: "CANCELED" },
      // })

      void stripeCustomerId
      break
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      const stripeCustomerId = invoice.customer as string

      // TODO: update Organization in DB
      // await db.organization.update({
      //   where: { stripeCustomerId },
      //   data: { subscriptionStatus: "PAST_DUE" },
      // })

      void stripeCustomerId
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
