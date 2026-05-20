import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { isValidTime } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import * as orgService from "@/lib/services/orgService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const VALID_VIEWS = new Set(["week", "timeline"])

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers))
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

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
        return NextResponse.json(
          { error: "Each hours entry must have isOpen (boolean), openTime and closeTime (HH:MM)" },
          { status: 400 },
        )
      }
    }
  }

  const merged = await orgService.updateOrgSettings(orgId, {
    hours:               body.hours,
    defaultScheduleView: body.defaultScheduleView as "week" | "timeline" | undefined,
    timeOffEnabled:      body.timeOffEnabled,
  })

  return NextResponse.json({ data: merged })
}
