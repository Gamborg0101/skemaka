import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { serOrg, serJobRole, serShiftTemplate } from "@/lib/serialize"

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
  const { jobRoles } = organization

  return NextResponse.json(
    {
      data: {
        org: serOrg(organization),
        jobRoles: jobRoles.map(serJobRole),
        shiftTemplates: organization.shiftTemplates.map(serShiftTemplate),
      },
    },
    { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" } }
  )
}
