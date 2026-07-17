import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { isSuperadmin } from "@/lib/platform"

async function requireSuperadmin() {
  const session = await auth()
  if (!session?.user?.email) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (!isSuperadmin(session.user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true }
}

export async function GET() {
  const guard = await requireSuperadmin()
  if ("error" in guard) return guard.error

  const orgs = await db.organization.findMany({
    // Throwaway demo sandboxes are noise here — 48h-lived and auto-created.
    where: { isDemo: false },
    select: {
      id: true,
      name: true,
      slug: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
      currency: true,
      createdAt: true,
      _count: {
        select: {
          employees: { where: { isActive: true } },
          shifts: true,
          memberships: true,
          // Open bugs only — the actionable count surfaced on the overview.
          bugReports: { where: { status: "OPEN" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const data = orgs.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
  }))

  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "private, no-store" } }
  )
}
