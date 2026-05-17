import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { serShiftTemplate } from "@/lib/serialize"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const templates = await db.shiftTemplate.findMany({
    where: { organizationId: orgId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })

  return NextResponse.json(
    { data: templates.map(serShiftTemplate) },
    { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" } }
  )
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const body = await req.json() as {
    name?: string; startTime?: string; endTime?: string
    breakMinutes?: number; jobRole?: string; colorTag?: string | null
  }

  const { name, startTime, endTime, breakMinutes, jobRole, colorTag } = body

  if (!name?.trim() || !startTime || !endTime) {
    return NextResponse.json(
      { error: "name, startTime, and endTime are required" },
      { status: 400 }
    )
  }

  const existing = await db.shiftTemplate.findFirst({
    where: { organizationId: orgId, name: name.trim() },
  })
  if (existing) {
    return NextResponse.json(
      { error: "A shift type with this name already exists" },
      { status: 409 }
    )
  }

  const count = await db.shiftTemplate.count({ where: { organizationId: orgId } })

  const template = await db.shiftTemplate.create({
    data: {
      organizationId: orgId,
      name: name.trim(),
      startTime,
      endTime,
      breakMinutes: breakMinutes ?? 0,
      jobRole: jobRole ?? "",
      colorTag: colorTag ?? null,
      sortOrder: count,
    },
  })

  return NextResponse.json({ data: serShiftTemplate(template) }, { status: 201 })
}
