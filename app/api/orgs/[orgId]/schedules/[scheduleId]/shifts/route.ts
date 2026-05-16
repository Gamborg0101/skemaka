import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { serShift } from "@/lib/serialize"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { isValidDate, isValidTime, isNonNegativeInt, timesAreDifferent } from "@/lib/validate"

const SHIFT_EMPLOYEE_SELECT = {
  id: true, organizationId: true, userId: true,
  name: true, email: true, phone: true, jobRole: true,
  hourlyWage: true, employmentType: true, contractedHours: true,
  notes: true, isActive: true, createdAt: true, updatedAt: true,
} as const

interface RouteContext {
  params: Promise<{ orgId: string; scheduleId: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { orgId, scheduleId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const shifts = await db.shift.findMany({
    where: { scheduleId, organizationId: orgId },
    include: { employee: { select: SHIFT_EMPLOYEE_SELECT } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  })

  return NextResponse.json({ data: shifts.map(serShift) })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId, scheduleId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const { success } = await rateLimitRequest(getClientIp(req.headers))
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const body = await req.json() as {
    employeeId?: string; date?: string; startTime?: string; endTime?: string
    breakMinutes?: number; jobRole?: string; notes?: string; colorTag?: string
  }

  const { employeeId, date, startTime, endTime, breakMinutes, jobRole, notes, colorTag } = body

  if (!employeeId || !date || !startTime || !endTime || !jobRole) {
    return NextResponse.json(
      { error: "employeeId, date, startTime, endTime, and jobRole are required" },
      { status: 400 }
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

  const dateUTC = new Date(date + "T00:00:00Z")
  const existing = await db.shift.findFirst({
    where: { organizationId: orgId, employeeId, date: dateUTC },
    orderBy: { createdAt: "asc" },
  })
  if (existing) {
    return NextResponse.json(
      { error: "This employee already has a shift on this date" },
      { status: 409 }
    )
  }

  const shift = await db.shift.create({
    data: {
      scheduleId,
      organizationId: orgId,
      employeeId,
      date: dateUTC,
      startTime,
      endTime,
      breakMinutes: breakMinutes ?? 0,
      jobRole,
      notes: notes ?? null,
      colorTag: colorTag ?? null,
    },
  })

  await db.schedulingEvent.create({
    data: {
      organizationId: orgId,
      eventType: "SHIFT_CREATED",
      payload: { shiftId: shift.id, scheduleId, employeeId, date, jobRole },
    },
  })

  return NextResponse.json({ data: serShift(shift) }, { status: 201 })
}
