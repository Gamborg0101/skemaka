import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { isValidDate, parsePaginationParams } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import * as availabilityService from "@/lib/services/availabilityService"
import { db } from "@/lib/prisma"
import type { OrgScheduleSettings, DayHours } from "@/types"

// `deadline` is a full ISO datetime (end-of-day) from the client, not a bare
// calendar date, so validate it as a parseable timestamp rather than with
// isValidDate. The auto-create path passes a date-only string, also parseable.
const CreateAvailabilitySchema = z.object({
  weekStart: z.string().refine(isValidDate, "weekStart must be a valid YYYY-MM-DD date"),
  deadline:  z.string().refine((s) => !isNaN(Date.parse(s)), "deadline must be a valid date"),
})

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

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(req, CreateAvailabilitySchema)
  if ("error" in parsed) return parsed.error
  const { weekStart, deadline } = parsed.data

  const request = await availabilityService.createAvailabilityRequest(orgId, weekStart, deadline)
  return NextResponse.json({ data: request }, { status: 201 })
}
