import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { serSchedule } from "@/lib/serialize"
import { sendSchedulePublishedSms } from "@/lib/sms"
import { formatWeekLabel, formatTime } from "@/lib/dateUtils"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { isValidDate } from "@/lib/validate"

// Select employee fields needed for shift display — excludes inviteToken/inviteExpiry
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

  const schedule = await db.schedule.findFirst({
    where: { id: scheduleId, organizationId: orgId },
    include: {
      shifts: {
        include: { employee: { select: SHIFT_EMPLOYEE_SELECT } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      },
    },
  })

  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(
    { data: serSchedule(schedule) },
    { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=120" } }
  )
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId, scheduleId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const body = await req.json() as { weekStart?: string }
  const { weekStart } = body

  if (!weekStart) {
    return NextResponse.json({ error: "weekStart is required" }, { status: 400 })
  }
  if (!isValidDate(weekStart)) {
    return NextResponse.json({ error: "weekStart must be a valid YYYY-MM-DD date" }, { status: 400 })
  }

  const source = await db.schedule.findFirst({
    where: { id: scheduleId, organizationId: orgId },
    include: { shifts: true },
  })

  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const weekDiff = new Date(weekStart + "T00:00:00Z").getTime() - source.weekStart.getTime()

  const newSchedule = await db.schedule.create({
    data: {
      organizationId: orgId,
      weekStart: new Date(weekStart + "T00:00:00Z"),
      isDuplicate: true,
      sourceScheduleId: scheduleId,
    },
  })

  if (source.shifts.length > 0) {
    await db.shift.createMany({
      data: source.shifts.map((shift) => ({
        scheduleId: newSchedule.id,
        organizationId: orgId,
        employeeId: shift.employeeId,
        date: new Date(shift.date.getTime() + weekDiff),
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes,
        jobRole: shift.jobRole,
        notes: shift.notes,
        colorTag: shift.colorTag,
      })),
    })
  }

  await db.schedulingEvent.create({
    data: {
      organizationId: orgId,
      eventType: "SCHEDULE_DUPLICATED",
      payload: { sourceScheduleId: scheduleId, newScheduleId: newSchedule.id, weekStart },
    },
  })

  const result = await db.schedule.findUnique({
    where: { id: newSchedule.id },
    include: { shifts: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } },
  })

  return NextResponse.json({ data: serSchedule(result!) }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId, scheduleId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const { success } = await rateLimitRequest(getClientIp(req.headers))
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const body = await req.json() as { published?: boolean }
  if (body.published !== true) {
    return NextResponse.json({ error: "Only { published: true } is supported" }, { status: 400 })
  }

  const schedule = await db.schedule.findFirst({
    where: { id: scheduleId, organizationId: orgId },
    include: {
      shifts: {
        where: { colorTag: { not: "sick" } },
        include: { employee: { select: { id: true, name: true, phone: true } } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      },
      organization: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (schedule.publishedAt) return NextResponse.json({ error: "Already published" }, { status: 409 })

  const updated = await db.schedule.update({
    where: { id: scheduleId },
    data: { publishedAt: new Date() },
    include: { shifts: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } },
  })

  // Group shifts by employee and send one SMS per employee
  const byEmployee = new Map<string, { name: string; phone: string | null; lines: string[] }>()
  for (const shift of schedule.shifts) {
    const emp = shift.employee
    if (!byEmployee.has(emp.id)) {
      byEmployee.set(emp.id, { name: emp.name, phone: emp.phone, lines: [] })
    }
    const entry = byEmployee.get(emp.id)!
    const day = new Date(shift.date).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })
    entry.lines.push(`${day} ${formatTime(shift.startTime)}–${formatTime(shift.endTime)}`)
  }

  const weekLabel = formatWeekLabel(schedule.weekStart.toISOString().split("T")[0])
  const orgName = schedule.organization.name

  for (const { name, phone, lines } of byEmployee.values()) {
    if (phone) {
      void sendSchedulePublishedSms({ to: phone, employeeName: name.split(" ")[0], orgName, weekLabel, shiftLines: lines })
    }
  }

  return NextResponse.json({ data: serSchedule(updated) })
}
