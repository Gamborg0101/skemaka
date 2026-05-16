import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"

interface RouteContext {
  params: Promise<{ orgId: string; templateId: string }>
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { orgId, templateId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const template = await db.shiftTemplate.findFirst({
    where: { id: templateId, organizationId: orgId },
  })
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await db.shiftTemplate.delete({ where: { id: templateId } })

  return new NextResponse(null, { status: 204 })
}
