import { NextRequest, NextResponse } from "next/server"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { isValidDate, isValidTime } from "@/lib/validate"
import * as availabilityService from "@/lib/services/availabilityService"

interface RouteContext {
  params: Promise<{ token: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { success } = await rateLimitRequest(getClientIp(req.headers))
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const { token } = await params
  const ctx = await availabilityService.resolveInviteToken(token)
  if (!ctx) return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 })

  return NextResponse.json(
    { data: { employee: ctx.employee, request: ctx.request, orgName: ctx.orgName } },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
  )
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { success } = await rateLimitRequest(getClientIp(req.headers))
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const { token } = await params
  const ctx = await availabilityService.resolveInviteToken(token)
  if (!ctx) return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 })

  if (ctx.request.status !== "OPEN") {
    return NextResponse.json(
      { error: "This availability request is no longer accepting submissions" },
      { status: 409 },
    )
  }

  const body = await req.json() as {
    days?: { date: string; isAvailable: boolean; preferredStart?: string; preferredEnd?: string }[]
  }
  const { days } = body

  if (!Array.isArray(days) || days.length === 0) {
    return NextResponse.json({ error: "days array is required" }, { status: 400 })
  }
  for (const day of days) {
    if (!isValidDate(day.date)) {
      return NextResponse.json({ error: `Invalid date: ${day.date}` }, { status: 400 })
    }
    if (typeof day.isAvailable !== "boolean") {
      return NextResponse.json({ error: "isAvailable must be a boolean" }, { status: 400 })
    }
    if (day.preferredStart != null && !isValidTime(day.preferredStart)) {
      return NextResponse.json({ error: `Invalid preferredStart: ${day.preferredStart}` }, { status: 400 })
    }
    if (day.preferredEnd != null && !isValidTime(day.preferredEnd)) {
      return NextResponse.json({ error: `Invalid preferredEnd: ${day.preferredEnd}` }, { status: 400 })
    }
  }

  await availabilityService.submitAvailability(ctx.requestId, ctx.employeeId, ctx.organizationId, days)
  return NextResponse.json({ data: { submitted: true } }, { status: 201 })
}
