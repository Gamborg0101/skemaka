import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import type { OrgScheduleSettings } from "@/types"
import { isValidTime } from "@/lib/validate"

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
    timeOffEnabled?: boolean
  }

  if (!body.hours && !body.defaultScheduleView && body.timeOffEnabled === undefined) {
    return NextResponse.json({ error: "No settings fields provided" }, { status: 400 })
  }

  if (body.defaultScheduleView && !VALID_VIEWS.has(body.defaultScheduleView)) {
    return NextResponse.json({ error: "Invalid defaultScheduleView" }, { status: 400 })
  }

  if (body.hours !== undefined) {
    if (!Array.isArray(body.hours) || body.hours.length !== 7) {
      return NextResponse.json({ error: "hours must be an array of exactly 7 days" }, { status: 400 })
    }
    for (const day of body.hours) {
      if (typeof day.isOpen !== "boolean" || !isValidTime(day.openTime) || !isValidTime(day.closeTime)) {
        return NextResponse.json({ error: "Each hours entry must have isOpen (boolean), openTime and closeTime (HH:MM)" }, { status: 400 })
      }
    }
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
  if (body.timeOffEnabled !== undefined) merged.timeOffEnabled = body.timeOffEnabled

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.organization.update({
    where: { id: orgId },
    data: { settings: merged as any },
  })

  return NextResponse.json({ data: merged })
}
