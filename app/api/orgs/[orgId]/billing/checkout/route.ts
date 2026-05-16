import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { stripe } from "@/lib/stripe"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, { allowSuspended: true })
  if ("error" in guard) return guard.error

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { stripeCustomerId: true },
  })

  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

  const priceId = process.env.STRIPE_PRICE_ID
  if (!priceId) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    ...(org.stripeCustomerId
      ? { customer: org.stripeCustomerId }
      : { customer_creation: "always" }),
    success_url: `${appUrl}/billing?success=1`,
    cancel_url: `${appUrl}/billing`,
    metadata: { organizationId: orgId },
  })

  return NextResponse.json({ url: session.url })
}
