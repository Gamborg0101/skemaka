import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { isValidDate, isValidTime, isValidColorTag } from "@/lib/validate"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as scheduleService from "@/lib/services/scheduleService"
import type { Shift } from "@/types"

interface RouteContext {
  params: Promise<{ orgId: string; scheduleId: string; shiftId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId, scheduleId, shiftId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const body = await req.json() as Partial<
    Pick<Shift, "date" | "startTime" | "endTime" | "breakMinutes" | "jobRole" | "notes" | "colorTag" | "employeeId">
  >

  if (body.date      !== undefined && !isValidDate(body.date)) {
    return NextResponse.json({ error: "date must be a valid YYYY-MM-DD" }, { status: 400 })
  }
  if (body.startTime !== undefined && !isValidTime(body.startTime)) {
    return NextResponse.json({ error: "startTime must be HH:MM" }, { status: 400 })
  }
  if (body.endTime   !== undefined && !isValidTime(body.endTime)) {
    return NextResponse.json({ error: "endTime must be HH:MM" }, { status: 400 })
  }
  if (body.colorTag !== undefined && !isValidColorTag(body.colorTag)) {
    return NextResponse.json({ error: "Invalid colorTag" }, { status: 400 })
  }

  try {
    const shift = await scheduleService.updateShift(orgId, scheduleId, shiftId, body)
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
