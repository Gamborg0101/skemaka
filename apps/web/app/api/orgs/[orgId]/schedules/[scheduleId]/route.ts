import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { isValidDate } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as scheduleService from "@/lib/services/scheduleService"

interface RouteContext {
  params: Promise<{ orgId: string; scheduleId: string }>
}

const DuplicateScheduleSchema = z.object({
  weekStart: z.string().refine(isValidDate, "weekStart must be a valid YYYY-MM-DD date"),
})

const PublishScheduleSchema = z
  .object({ published: z.boolean().optional() })
  .refine((b) => b.published === true, { message: "Only { published: true } is supported" })

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId, scheduleId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const schedule = await scheduleService.getScheduleById(orgId, scheduleId)
  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(
    { data: schedule },
    { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=120" } },
  )
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId, scheduleId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const parsed = await parseBody(req, DuplicateScheduleSchema)
  if ("error" in parsed) return parsed.error
  const { weekStart } = parsed.data

  try {
    const schedule = await scheduleService.duplicateSchedule(orgId, scheduleId, weekStart)
    return NextResponse.json({ data: schedule }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId, scheduleId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(req, PublishScheduleSchema)
  if ("error" in parsed) return parsed.error

  try {
    const { schedule, notified } = await scheduleService.publishSchedule(orgId, scheduleId)
    return NextResponse.json({ data: schedule, notified })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
