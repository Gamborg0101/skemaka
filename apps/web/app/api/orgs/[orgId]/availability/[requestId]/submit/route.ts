import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, parseBody } from "@/lib/apiGuard"
import { isValidDate, isValidTime } from "@/lib/validate"
import { db } from "@/lib/prisma"
import * as availabilityService from "@/lib/services/availabilityService"

interface RouteContext {
  params: Promise<{ orgId: string; requestId: string }>
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

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId, requestId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const employeeId = await availabilityService.getEmployeeIdForUser(orgId, guard.userId)
  if (!employeeId) {
    return NextResponse.json({ error: "Employee record not found" }, { status: 404 })
  }

  const request = await db.availabilityRequest.findFirst({
    where: { id: requestId, organizationId: orgId },
    select: { id: true, status: true },
    orderBy: { createdAt: "asc" },
  })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (request.status !== "OPEN") {
    return NextResponse.json({ error: "This request is no longer accepting submissions" }, { status: 409 })
  }

  const parsed = await parseBody(req, SubmitAvailabilitySchema)
  if ("error" in parsed) return parsed.error

  await availabilityService.submitAvailability(requestId, employeeId, orgId, parsed.data.days)
  return NextResponse.json({ data: { submitted: true } }, { status: 201 })
}
