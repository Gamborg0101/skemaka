import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { isValidTime } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import * as orgService from "@/lib/services/orgService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const VALID_VIEWS = new Set(["week", "timeline"])
const VALID_TIME_FORMATS = new Set(["12h", "24h"])

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  let body: {
    hours?: Array<{ isOpen: boolean; openTime: string; closeTime: string }>
    defaultScheduleView?: string
    timeOffEnabled?: boolean
    availabilityWindowWeeks?: number
    timeFormat?: string
    includeManagerInSchedule?: boolean
    fullTimeHours?: number
    reducedFullTimeHours?: number
    timelineBufferHours?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.hours && !body.defaultScheduleView && body.timeOffEnabled === undefined && body.availabilityWindowWeeks === undefined && body.timeFormat === undefined && body.includeManagerInSchedule === undefined && body.fullTimeHours === undefined && body.reducedFullTimeHours === undefined && body.timelineBufferHours === undefined) {
    return NextResponse.json({ error: "No settings fields provided" }, { status: 400 })
  }
  if (body.timelineBufferHours !== undefined && (!Number.isInteger(body.timelineBufferHours) || body.timelineBufferHours < 0 || body.timelineBufferHours > 4)) {
    return NextResponse.json({ error: "timelineBufferHours must be an integer between 0 and 4" }, { status: 400 })
  }
  // Work-week hours: integers within a sane range (1–80 h/week).
  for (const [key, val] of [["fullTimeHours", body.fullTimeHours], ["reducedFullTimeHours", body.reducedFullTimeHours]] as const) {
    if (val !== undefined && (!Number.isInteger(val) || val < 1 || val > 80)) {
      return NextResponse.json({ error: `${key} must be an integer between 1 and 80` }, { status: 400 })
    }
  }
  if (body.includeManagerInSchedule !== undefined && typeof body.includeManagerInSchedule !== "boolean") {
    return NextResponse.json({ error: "includeManagerInSchedule must be a boolean" }, { status: 400 })
  }
  if (body.timeFormat !== undefined && !VALID_TIME_FORMATS.has(body.timeFormat)) {
    return NextResponse.json({ error: "timeFormat must be '12h' or '24h'" }, { status: 400 })
  }
  if (body.availabilityWindowWeeks !== undefined) {
    const w = body.availabilityWindowWeeks
    if (!Number.isInteger(w) || w < 1 || w > 8) {
      return NextResponse.json({ error: "availabilityWindowWeeks must be an integer 1–8" }, { status: 400 })
    }
  }
  if (body.defaultScheduleView && !VALID_VIEWS.has(body.defaultScheduleView)) {
    return NextResponse.json({ error: "Invalid defaultScheduleView" }, { status: 400 })
  }
  if (body.timeOffEnabled !== undefined && typeof body.timeOffEnabled !== "boolean") {
    return NextResponse.json({ error: "timeOffEnabled must be a boolean" }, { status: 400 })
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
    hours:                    body.hours,
    defaultScheduleView:      body.defaultScheduleView as "week" | "timeline" | undefined,
    timeOffEnabled:           body.timeOffEnabled,
    availabilityWindowWeeks:  body.availabilityWindowWeeks,
    timeFormat:               body.timeFormat as "12h" | "24h" | undefined,
    includeManagerInSchedule: body.includeManagerInSchedule,
    fullTimeHours:            body.fullTimeHours,
    reducedFullTimeHours:     body.reducedFullTimeHours,
    timelineBufferHours:      body.timelineBufferHours,
  })

  // Adding/removing the manager as a schedulable person is a side effect of the
  // toggle — sync their self-linked Employee record to match.
  if (body.includeManagerInSchedule !== undefined) {
    await orgService.syncManagerEmployee(
      orgId,
      { userId: guard.userId, email: guard.email, name: guard.name },
      body.includeManagerInSchedule,
    )
  }

  return NextResponse.json({ data: merged })
}
