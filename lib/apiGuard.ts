import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { NextResponse } from "next/server"

type GuardOptions = { allowSuspended?: boolean }

export async function requireOrgMember(orgId: string, options: GuardOptions = {}) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { allowSuspended = false } = options

  // Fast path: orgId is cached in the JWT — no DB roundtrip needed.
  if (session.user.orgId) {
    if (session.user.orgId !== orgId) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
    }
    if (!allowSuspended && session.user.subscriptionStatus === "CANCELED") {
      return {
        error: NextResponse.json(
          { error: "Subscription cancelled", code: "SUBSCRIPTION_CANCELED" },
          { status: 402 }
        ),
      }
    }
    return { userId: session.user.id, membership: null }
  }

  // Slow path: token predates the orgId claim (e.g. just completed onboarding).
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
    include: { organization: { select: { subscriptionStatus: true } } },
  })
  if (!membership) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  if (!allowSuspended && membership.organization.subscriptionStatus === "CANCELED") {
    return {
      error: NextResponse.json(
        { error: "Subscription cancelled", code: "SUBSCRIPTION_CANCELED" },
        { status: 402 }
      ),
    }
  }
  return { userId: session.user.id, membership }
}
