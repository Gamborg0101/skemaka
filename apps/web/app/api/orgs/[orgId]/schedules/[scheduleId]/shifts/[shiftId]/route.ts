import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { isValidDate, isValidTime, isValidColorTag } from "@/lib/validate"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as scheduleService from "@/lib/services/scheduleService"

interface RouteContext {
  params: Promise<{ orgId: string; scheduleId: string; shiftId: string }>
}

// Only the fields the original handler validated are constrained here; the rest
// pass through unchanged (matching prior behavior) into UpdateShiftInput.
const UpdateShiftSchema = z.object({
  employeeId:   z.string().optional(),
  date:         z.string().refine(isValidDate, "date must be a valid YYYY-MM-DD").optional(),
  startTime:    z.string().refine(isValidTime, "startTime must be HH:MM").optional(),
  endTime:      z.string().refine(isValidTime, "endTime must be HH:MM").optional(),
  breakMinutes: z.number().optional(),
  jobRole:      z.string().optional(),
  notes:        z.string().nullable().optional(),
  colorTag:     z.string().refine((s) => isValidColorTag(s), "Invalid colorTag").nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId, scheduleId, shiftId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(req, UpdateShiftSchema)
  if ("error" in parsed) return parsed.error

  try {
    const shift = await scheduleService.updateShift(orgId, scheduleId, shiftId, parsed.data)
    return NextResponse.json({ data: shift })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { orgId, scheduleId, shiftId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success: deleteOk } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!deleteOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  try {
    await scheduleService.deleteShift(orgId, scheduleId, shiftId)
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
