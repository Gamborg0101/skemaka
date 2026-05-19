import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { isValidDate, parsePaginationParams } from "@/lib/validate"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as scheduleService from "@/lib/services/scheduleService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const weekStart = req.nextUrl.searchParams.get("weekStart")

  if (weekStart) {
    if (!isValidDate(weekStart)) {
      return NextResponse.json({ error: "weekStart must be a valid YYYY-MM-DD date" }, { status: 400 })
    }
    const schedule = await scheduleService.getScheduleByWeek(orgId, weekStart)
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

  const body = await req.json() as { weekStart?: string }
  const { weekStart } = body

  if (!weekStart) {
    return NextResponse.json({ error: "weekStart is required" }, { status: 400 })
  }
  if (!isValidDate(weekStart)) {
    return NextResponse.json({ error: "weekStart must be a valid YYYY-MM-DD date" }, { status: 400 })
  }

  try {
    const { schedule, created } = await scheduleService.getOrCreateSchedule(orgId, weekStart)
    return NextResponse.json({ data: schedule }, { status: created ? 201 : 200 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
