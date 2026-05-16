import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { serOrg, serJobRole, serShiftTemplate } from "@/lib/serialize"

const DEFAULT_ROLES = [
  { name: "Barista", color: "blue" },
  { name: "Kitchen", color: "orange" },
  { name: "Supervisor", color: "purple" },
  { name: "Server", color: "yellow" },
  { name: "Cashier", color: "green" },
]

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id, role: "MANAGER" },
    include: {
      organization: {
        include: {
          jobRoles: { orderBy: { name: "asc" } },
          shiftTemplates: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  })

  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 })
  }

  const { organization } = membership
  let { jobRoles } = organization

  if (jobRoles.length === 0) {
    await db.jobRole.createMany({
      data: DEFAULT_ROLES.map((r) => ({ ...r, organizationId: organization.id })),
    })
    jobRoles = await db.jobRole.findMany({
      where: { organizationId: organization.id },
      orderBy: { name: "asc" },
    })
  }

  return NextResponse.json({
    data: {
      org: serOrg(organization),
      jobRoles: jobRoles.map(serJobRole),
      shiftTemplates: organization.shiftTemplates.map(serShiftTemplate),
    },
  })
}
