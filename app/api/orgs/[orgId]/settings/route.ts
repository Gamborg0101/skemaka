import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import type { OrgScheduleSettings } from "@/types"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const VALID_VIEWS = new Set(["week", "timeline"])

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const body = await req.json() as {
    hours?: Array<{ isOpen: boolean; openTime: string; closeTime: string }>
    defaultScheduleView?: string
  }

  if (!body.hours && !body.defaultScheduleView) {
    return NextResponse.json({ error: "No settings fields provided" }, { status: 400 })
  }

  if (body.defaultScheduleView && !VALID_VIEWS.has(body.defaultScheduleView)) {
    return NextResponse.json({ error: "Invalid defaultScheduleView" }, { status: 400 })
  }

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  })

  const current = (org?.settings as OrgScheduleSettings) ?? {}
  const merged: OrgScheduleSettings = { ...current }

  if (body.hours) merged.hours = body.hours
  if (body.defaultScheduleView) {
    merged.defaultScheduleView = body.defaultScheduleView as "week" | "timeline"
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.organization.update({
    where: { id: orgId },
    data: { settings: merged as any },
  })

  return NextResponse.json({ data: merged })
}
