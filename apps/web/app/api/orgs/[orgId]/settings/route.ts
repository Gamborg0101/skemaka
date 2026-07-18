import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { isValidTime } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import * as orgService from "@/lib/services/orgService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const HoursDaySchema = z.object({
  isOpen:    z.boolean(),
  openTime:  z.string().refine(isValidTime, "openTime and closeTime must be HH:MM"),
  closeTime: z.string().refine(isValidTime, "openTime and closeTime must be HH:MM"),
})

const SettingsSchema = z
  .object({
    hours:                    z.array(HoursDaySchema).length(7, "hours must be an array of exactly 7 days").optional(),
    defaultScheduleView:      z.enum(["week", "timeline"], { message: "Invalid defaultScheduleView" }).optional(),
    timeOffEnabled:           z.boolean().optional(),
    availabilityWindowWeeks:  z.number().int().min(1, "availabilityWindowWeeks must be an integer 1–8").max(8, "availabilityWindowWeeks must be an integer 1–8").optional(),
    timeFormat:               z.enum(["12h", "24h"], { message: "timeFormat must be '12h' or '24h'" }).optional(),
    includeManagerInSchedule: z.boolean().optional(),
    fullTimeHours:            z.number().int().min(1, "fullTimeHours must be an integer between 1 and 80").max(80, "fullTimeHours must be an integer between 1 and 80").optional(),
    reducedFullTimeHours:     z.number().int().min(1, "reducedFullTimeHours must be an integer between 1 and 80").max(80, "reducedFullTimeHours must be an integer between 1 and 80").optional(),
    timelineBufferHours:      z.number().int().min(0, "timelineBufferHours must be an integer between 0 and 4").max(4, "timelineBufferHours must be an integer between 0 and 4").optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "No settings fields provided" })

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(req, SettingsSchema)
  if ("error" in parsed) return parsed.error
  const body = parsed.data

  const merged = await orgService.updateOrgSettings(orgId, {
    hours:                    body.hours,
    defaultScheduleView:      body.defaultScheduleView,
    timeOffEnabled:           body.timeOffEnabled,
    availabilityWindowWeeks:  body.availabilityWindowWeeks,
    timeFormat:               body.timeFormat,
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
