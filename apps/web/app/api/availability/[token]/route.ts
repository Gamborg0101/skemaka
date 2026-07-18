import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { isValidDate, isValidTime } from "@/lib/validate"
import * as availabilityService from "@/lib/services/availabilityService"

interface RouteContext {
  params: Promise<{ token: string }>
}

// Times are only validated for available days, matching the original handler.
const DaySchema = z
  .object({
    date:        z.string(),
    isAvailable: z.boolean(),
    startTime:   z.string().nullable().optional(),
    endTime:     z.string().nullable().optional(),
  })
  .superRefine((d, ctx) => {
    if (!isValidDate(d.date)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid date: ${d.date}` })
    }
    if (d.isAvailable) {
      if (d.startTime != null && !isValidTime(d.startTime)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid startTime: ${d.startTime}` })
      }
      if (d.endTime != null && !isValidTime(d.endTime)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid endTime: ${d.endTime}` })
      }
      if (d.startTime && d.endTime && d.endTime <= d.startTime) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "endTime must be after startTime" })
      }
    }
  })

const SubmitAvailabilitySchema = z.object({
  days: z.array(DaySchema).min(1, "days array is required"),
})

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const { token } = await params
  const ctx = await availabilityService.resolveInviteToken(token)
  if (!ctx) return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 })

  // Public, unauthenticated endpoint — only expose fields the availability page
  // needs. ctx.employee is the full record (wage, phone, email, notes); never
  // serialize those to a token-only caller.
  const employee = { id: ctx.employee.id, name: ctx.employee.name, jobRole: ctx.employee.jobRole }
  return NextResponse.json(
    { data: { employee, request: ctx.request, orgName: ctx.orgName } },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
  )
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
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

  const parsed = await parseBody(req, SubmitAvailabilitySchema)
  if ("error" in parsed) return parsed.error

  await availabilityService.submitAvailability(ctx.requestId, ctx.employeeId, ctx.organizationId, parsed.data.days)
  return NextResponse.json({ data: { submitted: true } }, { status: 201 })
}
