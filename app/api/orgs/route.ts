import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { serOrg } from "@/lib/serialize"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { success } = await rateLimitRequest(getClientIp(req.headers))
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const VALID_CURRENCIES = ["EUR", "USD", "GBP", "DKK", "SEK", "NOK"]

  const body = await req.json() as { name?: string; currency?: string }
  const { name, currency } = body

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const trimmedName = name.trim()
  const resolvedCurrency = currency && VALID_CURRENCIES.includes(currency) ? currency : "EUR"
  const baseSlug = trimmedName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")

  let slug = baseSlug
  let suffix = 1
  while (await db.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`
  }

  const org = await db.organization.create({
    data: { name: trimmedName, slug, currency: resolvedCurrency },
  })

  await db.membership.create({
    data: { userId: session.user.id, organizationId: org.id, role: "MANAGER" },
  })

  // Seed default job roles so new orgs can start scheduling immediately
  await db.jobRole.createMany({
    data: [
      { organizationId: org.id, name: "Waiter",     color: "blue"   },
      { organizationId: org.id, name: "Chef",        color: "orange" },
      { organizationId: org.id, name: "Bartender",   color: "purple" },
      { organizationId: org.id, name: "Manager",     color: "green"  },
      { organizationId: org.id, name: "Host",        color: "rose"   },
      { organizationId: org.id, name: "Cashier",     color: "yellow" },
    ],
  })

  return NextResponse.json({ data: serOrg(org) }, { status: 201 })
}
