import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { serJobRole } from "@/lib/serialize"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const roles = await db.jobRole.findMany({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(
    { data: roles.map(serJobRole) },
    { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" } }
  )
}
