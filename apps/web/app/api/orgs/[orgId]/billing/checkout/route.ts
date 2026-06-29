import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { stripe } from "@/lib/stripe"
import { activeSeatCount } from "@/lib/services/billingService"
import { logError, requestIdFrom } from "@/lib/log"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req, { allowSuspended: true })
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

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

  // Per-employee pricing: subscribe with one seat per active employee.
  // Later add/remove/deactivate operations re-sync via syncSubscriptionQuantity.
  const quantity = await activeSeatCount(orgId)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity }],
      ...(org.stripeCustomerId ? { customer: org.stripeCustomerId } : {}),
      success_url: `${appUrl}/billing?success=1`,
      cancel_url: `${appUrl}/billing`,
      metadata: { organizationId: orgId },
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    logError("billing/checkout", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}
