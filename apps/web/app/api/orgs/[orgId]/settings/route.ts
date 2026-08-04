import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { isValidTime } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import * as orgService from "@/lib/services/orgService"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import { logError, requestIdFrom } from "@/lib/log"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const HoursDaySchema = z
  .object({
    isOpen:    z.boolean(),
    openTime:  z.string().refine(isValidTime, "openTime and closeTime must be HH:MM"),
    closeTime: z.string().refine(isValidTime, "openTime and closeTime must be HH:MM"),
  })
  // Both fields were validated independently and never against each other, so a
  // bar could save 16:00–01:00. The schedule timeline derives its axis from
  // these hours as same-day values, so a close before the open made
  // (endHour - startHour) negative — every shift position and width then
  // divided by a negative number and the day rendered blank. Overnight *shifts*
  // are supported (see lib/validate.ts) but store hours never learned the same
  // trick, so reject it clearly rather than accept it and break the schedule.
  .refine(
    (d) => !d.isOpen || d.closeTime > d.openTime,
    { message: "closeTime must be after openTime — hours that run past midnight aren't supported yet" },
  )

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

  // Order matters. Adding the manager as a schedulable person consumes a seat,
  // so syncManagerEmployee can legitimately throw SEAT_LIMIT — and this route
  // previously ran it AFTER the settings write had already committed. The
  // result was a 500, a generic toast, the toggle reverting in the UI, and the
  // flag still true in the database: reload the page and the server and the
  // screen disagreed. Doing the failure-prone half first means a rejection
  // leaves nothing changed.
  try {
    if (body.includeManagerInSchedule !== undefined) {
      await orgService.syncManagerEmployee(
        orgId,
        { userId: guard.userId, email: guard.email, name: guard.name },
        body.includeManagerInSchedule,
      )
    }

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

    return NextResponse.json({ data: merged })
  } catch (err) {
    // Every other mutating route in the app does this; this one was the
    // exception, so a SEAT_LIMIT surfaced as a bare 500 instead of the "your
    // plan covers N employees" message the same failure shows everywhere else.
    if (err instanceof ServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: serviceErrorStatus(err.code) },
      )
    }
    logError("orgs/settings", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
