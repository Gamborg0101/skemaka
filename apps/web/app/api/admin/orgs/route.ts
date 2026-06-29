import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"

export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const orgs = await db.organization.findMany({
    include: {
      _count: {
        select: {
          memberships: true,
          employees: { where: { isActive: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    data: orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      currency: org.currency,
      stripeCustomerId: org.stripeCustomerId,
      stripeSubscriptionId: org.stripeSubscriptionId,
      subscriptionStatus: org.subscriptionStatus,
      employeeCount: org._count.employees,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
      memberCount: org._count.memberships,
      activeEmployeeCount: org._count.employees,
    })),
  })
}
