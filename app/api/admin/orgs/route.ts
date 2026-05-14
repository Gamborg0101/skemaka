import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { AdminOrganizationView } from "@/types"

export async function GET(_req: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // TODO: replace with DB query
  // const orgs = await db.organization.findMany({
  //   include: {
  //     _count: {
  //       select: { memberships: true, employees: { where: { isActive: true } } },
  //     },
  //   },
  //   orderBy: { createdAt: "desc" },
  // })
  // return NextResponse.json({
  //   data: orgs.map((org) => ({
  //     ...org,
  //     createdAt: org.createdAt.toISOString(),
  //     updatedAt: org.updatedAt.toISOString(),
  //     memberCount: org._count.memberships,
  //     activeEmployeeCount: org._count.employees,
  //   })),
  // })

  const mockOrgs: AdminOrganizationView[] = [
    {
      id: "org_mock_001",
      name: "The Daily Grind Café",
      slug: "the-daily-grind-cafe",
      stripeCustomerId: "cus_mock_001",
      stripeSubscriptionId: "sub_mock_001",
      subscriptionStatus: "ACTIVE",
      employeeCount: 4,
      createdAt: "2025-01-01T08:00:00.000Z",
      updatedAt: "2025-05-01T08:00:00.000Z",
      memberCount: 2,
      activeEmployeeCount: 4,
    },
    {
      id: "org_mock_002",
      name: "Sunrise Bakery",
      slug: "sunrise-bakery",
      stripeCustomerId: "cus_mock_002",
      stripeSubscriptionId: null,
      subscriptionStatus: "TRIALING",
      employeeCount: 2,
      createdAt: "2025-03-15T10:00:00.000Z",
      updatedAt: "2025-03-15T10:00:00.000Z",
      memberCount: 1,
      activeEmployeeCount: 2,
    },
  ]

  return NextResponse.json({ data: mockOrgs })
}
