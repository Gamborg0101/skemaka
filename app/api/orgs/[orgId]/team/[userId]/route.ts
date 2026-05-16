import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"

interface RouteContext {
  params: Promise<{ orgId: string; userId: string }>
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { orgId, userId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  if (userId === guard.userId) {
    return NextResponse.json({ error: "You cannot remove your own access" }, { status: 409 })
  }

  const target = await db.user.findUnique({ where: { id: userId } })
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (target.role === "ADMIN") {
    return NextResponse.json({ error: "Cannot remove an admin's access" }, { status: 403 })
  }

  await db.$transaction([
    db.membership.update({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      data: { role: "EMPLOYEE" },
    }),
    db.user.update({ where: { id: userId }, data: { role: "EMPLOYEE" } }),
  ])

  return new NextResponse(null, { status: 204 })
}
