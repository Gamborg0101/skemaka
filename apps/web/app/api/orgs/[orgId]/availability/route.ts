import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { isValidDate, parsePaginationParams } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import * as availabilityService from "@/lib/services/availabilityService"
import { db } from "@/lib/prisma"
import type { OrgScheduleSettings, DayHours } from "@/types"

const DEFAULT_HOURS: DayHours[] = [
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" },
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" },
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" },
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" },
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" },
  { isOpen: true,  openTime: "09:00", closeTime: "17:00" },
  { isOpen: false, openTime: "09:00", closeTime: "17:00" },
]

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const week = req.nextUrl.searchParams.get("week")
  if (week) {
    if (!isValidDate(week)) {
      return NextResponse.json({ error: "week must be a valid YYYY-MM-DD date" }, { status: 400 })
    }
    const [request, org] = await Promise.all([
      availabilityService.getOrCreateForWeek(orgId, week),
      db.organization.findUnique({ where: { id: orgId }, select: { settings: true } }),
    ])
    const settings = org?.settings as OrgScheduleSettings | null
    const orgHours: DayHours[] = settings?.hours?.length === 7 ? settings.hours as DayHours[] : DEFAULT_HOURS
    return NextResponse.json({ data: request ?? null, orgHours })
  }

  const pagination = parsePaginationParams(req.nextUrl, { limit: 50, maxLimit: 200 })
  const result = await availabilityService.listAvailabilityRequests(orgId, pagination)
  return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers))
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const body = await req.json() as { weekStart?: string; deadline?: string }
  const { weekStart, deadline } = body

  if (!weekStart || !deadline) {
    return NextResponse.json({ error: "weekStart and deadline are required" }, { status: 400 })
  }
  if (!isValidDate(weekStart) || !isValidDate(deadline)) {
    return NextResponse.json({ error: "weekStart and deadline must be valid dates" }, { status: 400 })
  }

  const request = await availabilityService.createAvailabilityRequest(orgId, weekStart, deadline)
  return NextResponse.json({ data: request }, { status: 201 })
}
