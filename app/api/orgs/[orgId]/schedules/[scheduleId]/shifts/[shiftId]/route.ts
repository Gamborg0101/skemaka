import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { serShift } from "@/lib/serialize"
import { sendShiftUpdatedSms, sendShiftAssignedSms, sendShiftCancelledSms } from "@/lib/sms"
import { isValidDate, isValidTime } from "@/lib/validate"
import type { Shift } from "@/types"

interface RouteContext {
  params: Promise<{ orgId: string; scheduleId: string; shiftId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId, scheduleId, shiftId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const existing = await db.shift.findFirst({
    where: { id: shiftId, scheduleId, organizationId: orgId },
    include: {
      employee: { select: { name: true, phone: true } },
      organization: { select: { name: true } },
    },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as Partial<
    Pick<Shift, "date" | "startTime" | "endTime" | "breakMinutes" | "jobRole" | "notes" | "colorTag" | "employeeId">
  >

  if (body.date !== undefined && !isValidDate(body.date)) {
    return NextResponse.json({ error: "date must be a valid YYYY-MM-DD" }, { status: 400 })
  }
  if (body.startTime !== undefined && !isValidTime(body.startTime)) {
    return NextResponse.json({ error: "startTime must be HH:MM" }, { status: 400 })
  }
  if (body.endTime !== undefined && !isValidTime(body.endTime)) {
    return NextResponse.json({ error: "endTime must be HH:MM" }, { status: 400 })
  }

  const shift = await db.shift.update({
    where: { id: shiftId },
    data: {
      ...(body.employeeId !== undefined && { employeeId: body.employeeId }),
      ...(body.date !== undefined && { date: new Date(body.date + "T00:00:00Z") }),
      ...(body.startTime !== undefined && { startTime: body.startTime }),
      ...(body.endTime !== undefined && { endTime: body.endTime }),
      ...(body.breakMinutes !== undefined && { breakMinutes: body.breakMinutes }),
      ...(body.jobRole !== undefined && { jobRole: body.jobRole }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.colorTag !== undefined && { colorTag: body.colorTag }),
    },
  })

  // ── SMS notifications ─────────────────────────────────────────────────────

  const newDate      = body.date      ?? existing.date.toISOString().split("T")[0]
  const newStartTime = body.startTime ?? existing.startTime
  const newEndTime   = body.endTime   ?? existing.endTime
  const orgName      = existing.organization.name

  const employeeChanged  = body.employeeId !== undefined && body.employeeId !== existing.employeeId
  const timingChanged    = body.date !== undefined || body.startTime !== undefined || body.endTime !== undefined
  const oldDate          = existing.date.toISOString().split("T")[0]

  if (employeeChanged) {
    // Old employee loses the shift
    if (existing.employee.phone) {
      void sendShiftCancelledSms({
        to: existing.employee.phone,
        employeeName: existing.employee.name,
        orgName,
        date: oldDate,
        startTime: existing.startTime,
        endTime: existing.endTime,
      })
    }

    // New employee gains the shift — fetch their contact details
    if (body.employeeId) {
      const newEmployee = await db.employee.findUnique({
        where: { id: body.employeeId },
        select: { name: true, phone: true },
      })
      if (newEmployee?.phone) {
        void sendShiftAssignedSms({
          to: newEmployee.phone,
          employeeName: newEmployee.name,
          orgName,
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
        })
      }
    }
  } else if (timingChanged && existing.employee.phone) {
    // Same employee, time/date changed
    void sendShiftUpdatedSms({
      to: existing.employee.phone,
      employeeName: existing.employee.name,
      orgName,
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
    })
  }

  return NextResponse.json({ data: serShift(shift) })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { orgId, scheduleId, shiftId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const existing = await db.shift.findFirst({
    where: { id: shiftId, scheduleId, organizationId: orgId },
    include: {
      employee: { select: { name: true, phone: true } },
      organization: { select: { name: true } },
    },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.shift.delete({ where: { id: shiftId } })

  if (existing.employee.phone) {
    void sendShiftCancelledSms({
      to: existing.employee.phone,
      employeeName: existing.employee.name,
      orgName: existing.organization.name,
      date: existing.date.toISOString().split("T")[0],
      startTime: existing.startTime,
      endTime: existing.endTime,
    })
  }

  return NextResponse.json({ data: { deleted: true } })
}
