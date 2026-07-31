import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { stripe } from "@/lib/stripe"
import { checkoutSeatCount } from "@/lib/services/billingService"
import { z } from "zod"
import { logError, requestIdFrom } from "@/lib/log"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

// The seat count is optional: the billing page sends what the manager picked,
// but a client that omits it falls back to the org's stored seats.
const CheckoutSchema = z.object({
  seats: z.number().int().min(1).max(500).optional(),
})

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req, { allowSuspended: true })
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(req, CheckoutSchema)
  if ("error" in parsed) return parsed.error
  const body = parsed.data

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

  // Seat licensing: subscribe with the seats the manager chose. Floored at the
  // base allowance and at the org's active-employee count, so a trial org that
  // added freely cannot check out with fewer seats than it has people.
  const quantity = await checkoutSeatCount(orgId, body?.seats)

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
