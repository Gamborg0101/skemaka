import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { isValidDate, isValidTime, isNonNegativeInt, timesAreDifferent, parsePaginationParams, isValidColorTag } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as scheduleService from "@/lib/services/scheduleService"

interface RouteContext {
  params: Promise<{ orgId: string; scheduleId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId, scheduleId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const pagination = parsePaginationParams(req.nextUrl, { limit: 200, maxLimit: 1000 })
  const result = await scheduleService.listShifts(orgId, scheduleId, pagination)
  return NextResponse.json(
    result,
    { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=120" } },
  )
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId, scheduleId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  let body: {
    employeeId?: string; date?: string; startTime?: string; endTime?: string
    breakMinutes?: number; jobRole?: string; notes?: string; colorTag?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const { employeeId, date, startTime, endTime, breakMinutes, jobRole, notes, colorTag } = body

  if (!employeeId || !date || !startTime || !endTime || !jobRole) {
    return NextResponse.json(
      { error: "employeeId, date, startTime, endTime, and jobRole are required" },
      { status: 400 },
    )
  }
  if (!isValidDate(date)) {
    return NextResponse.json({ error: "date must be a valid YYYY-MM-DD" }, { status: 400 })
  }
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return NextResponse.json({ error: "startTime and endTime must be HH:MM" }, { status: 400 })
  }
  if (!timesAreDifferent(startTime, endTime)) {
    return NextResponse.json({ error: "startTime and endTime must differ" }, { status: 400 })
  }
  if (!isNonNegativeInt(breakMinutes ?? 0)) {
    return NextResponse.json({ error: "breakMinutes must be a non-negative integer" }, { status: 400 })
  }
  if (jobRole.length > 100) return NextResponse.json({ error: "jobRole must be at most 100 characters" }, { status: 400 })
  if (notes && notes.length > 5000) return NextResponse.json({ error: "notes must be at most 5000 characters" }, { status: 400 })
  if (!isValidColorTag(colorTag)) return NextResponse.json({ error: "Invalid colorTag" }, { status: 400 })

  try {
    const shift = await scheduleService.createShift(orgId, scheduleId, {
      employeeId, date, startTime, endTime, breakMinutes, jobRole, notes, colorTag,
    })
    return NextResponse.json({ data: shift }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
