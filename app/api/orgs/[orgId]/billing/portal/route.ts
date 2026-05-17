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
    console.error("[billing/portal]", err)
    return NextResponse.json({ error: "Failed to create billing portal session" }, { status: 500 })
  }
}
