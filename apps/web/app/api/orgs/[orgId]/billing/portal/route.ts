import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { stripe } from "@/lib/stripe"
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

  if (!org?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account found" }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${appUrl}/billing`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    logError("billing/portal", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to create billing portal session" }, { status: 500 })
  }
}
