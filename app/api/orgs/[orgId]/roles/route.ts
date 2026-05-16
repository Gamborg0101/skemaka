import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { serJobRole } from "@/lib/serialize"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const DEFAULT_ROLES = [
  { name: "Barista", color: "blue" },
  { name: "Kitchen", color: "orange" },
  { name: "Supervisor", color: "purple" },
  { name: "Server", color: "yellow" },
  { name: "Cashier", color: "green" },
]

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  let roles = await db.jobRole.findMany({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
  })

  if (roles.length === 0) {
    await db.jobRole.createMany({
      data: DEFAULT_ROLES.map((r) => ({ ...r, organizationId: orgId })),
    })
    roles = await db.jobRole.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    })
  }

  return NextResponse.json({ data: roles.map(serJobRole) })
}
