import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { isValidDate, isValidTime, parsePaginationParams, isValidColorTag } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as scheduleService from "@/lib/services/scheduleService"

interface RouteContext {
  params: Promise<{ orgId: string; scheduleId: string }>
}

const CreateShiftSchema = z
  .object({
    employeeId:   z.string().min(1),
    date:         z.string().refine(isValidDate, "date must be a valid YYYY-MM-DD"),
    startTime:    z.string().refine(isValidTime, "startTime and endTime must be HH:MM"),
    endTime:      z.string().refine(isValidTime, "startTime and endTime must be HH:MM"),
    breakMinutes: z.number().int().min(0, "breakMinutes must be a non-negative integer").optional(),
    jobRole:      z.string().min(1).max(100, "jobRole must be at most 100 characters"),
    notes:        z.string().max(5000, "notes must be at most 5000 characters").nullable().optional(),
    colorTag:     z.string().refine((s) => isValidColorTag(s), "Invalid colorTag").nullable().optional(),
    notifyNow:    z.boolean().optional(),
  })
  // Sick days are zero-duration day markers (00:00–00:00), so the differ check
  // doesn't apply to them.
  .refine((b) => b.colorTag === "sick" || b.startTime !== b.endTime, {
    message: "startTime and endTime must differ",
    path: ["endTime"],
  })

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

  const parsed = await parseBody(req, CreateShiftSchema)
  if ("error" in parsed) return parsed.error

  try {
    const shift = await scheduleService.createShift(orgId, scheduleId, parsed.data)
    return NextResponse.json({ data: shift }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
