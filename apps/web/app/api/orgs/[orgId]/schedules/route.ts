import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { isValidDate, parsePaginationParams } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as scheduleService from "@/lib/services/scheduleService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const CreateScheduleSchema = z.object({
  weekStart: z.string().refine(isValidDate, "weekStart must be a valid YYYY-MM-DD date"),
})

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const weekStart = req.nextUrl.searchParams.get("weekStart")

  if (weekStart) {
    if (!isValidDate(weekStart)) {
      return NextResponse.json({ error: "weekStart must be a valid YYYY-MM-DD date" }, { status: 400 })
    }
    // Employees only ever see rolled-out shifts — drafts are the manager's
    // private planning space. This one server-side filter covers the web
    // portal, the mobile app, and any other employee-role reader.
    const isManager = guard.role === "MANAGER" || guard.role === "ADMIN"
    const schedule = await scheduleService.getScheduleByWeek(orgId, weekStart, { publishedOnly: !isManager })
    return NextResponse.json(
      { data: schedule },
      { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=120" } },
    )
  }

  const pagination = parsePaginationParams(req.nextUrl, { limit: 52, maxLimit: 104 })
  const result = await scheduleService.listSchedules(orgId, pagination)
  return NextResponse.json(
    result,
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
  )
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(req, CreateScheduleSchema)
  if ("error" in parsed) return parsed.error
  const { weekStart } = parsed.data

  try {
    const { schedule, created } = await scheduleService.getOrCreateSchedule(orgId, weekStart)
    return NextResponse.json({ data: schedule }, { status: created ? 201 : 200 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
