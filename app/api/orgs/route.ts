import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { rateLimitRequest } from "@/lib/upstash"
import type { Organization } from "@/types"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { success } = await rateLimitRequest(req.headers.get("x-forwarded-for") ?? "anonymous")
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const body = await req.json() as { name?: string }
  const { name } = body

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
  const now = new Date().toISOString()

  // TODO: create Organization + Membership in DB, create Stripe customer
  // const org = await db.organization.create({ data: { name: name.trim(), slug } })
  // await db.membership.create({ data: { userId: session.user.id, organizationId: org.id, role: "MANAGER" } })
  // const customer = await stripe.customers.create({ name: org.name, metadata: { orgId: org.id } })
  // await db.organization.update({ where: { id: org.id }, data: { stripeCustomerId: customer.id } })

  const mockOrg: Organization = {
    id: "org_mock_001",
    name: name.trim(),
    slug,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: "TRIALING",
    employeeCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  return NextResponse.json({ data: mockOrg }, { status: 201 })
}
