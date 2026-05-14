import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { Schedule, Shift, Employee } from "@/types"

interface RouteContext {
  params: Promise<{ orgId: string; scheduleId: string }>
}

const mockEmployee: Employee = {
  id: "emp_mock_001",
  organizationId: "org_mock_001",
  userId: null,
  name: "Alice Hansen",
  email: "alice@example.com",
  phone: "+45 12 34 56 78",
  jobRole: "Barista",
  hourlyWage: 155,
  notes: null,
  employmentType: "PART_TIME" as const,
      contractedHours: 0,
      isActive: true,
  inviteToken: null,
  inviteExpiry: null,
  createdAt: "2025-01-01T08:00:00.000Z",
  updatedAt: "2025-01-01T08:00:00.000Z",
}

const mockShifts: Shift[] = [
  {
    id: "shift_mock_001",
    scheduleId: "sched_mock_001",
    organizationId: "org_mock_001",
    employeeId: "emp_mock_001",
    date: "2025-05-12",
    startTime: "08:00",
    endTime: "16:00",
    breakMinutes: 30,
    jobRole: "Barista",
    notes: null,
    colorTag: "#3b82f6",
    createdAt: "2025-05-10T09:00:00.000Z",
    updatedAt: "2025-05-10T09:00:00.000Z",
    employee: mockEmployee,
  },
]

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgId, scheduleId } = await params

  // TODO: replace with DB query
  // const schedule = await db.schedule.findUnique({
  //   where: { id: scheduleId, organizationId: orgId },
  //   include: { shifts: { include: { employee: true }, orderBy: { date: "asc" } } },
  // })
  // if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const mockSchedule: Schedule = {
    id: scheduleId,
    organizationId: orgId,
    weekStart: "2025-05-12",
    isDuplicate: false,
    sourceScheduleId: null,
    createdAt: "2025-05-10T09:00:00.000Z",
    updatedAt: "2025-05-10T09:00:00.000Z",
    shifts: mockShifts.filter((s) => s.scheduleId === scheduleId || scheduleId === "sched_mock_001"),
  }

  return NextResponse.json({ data: mockSchedule })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgId, scheduleId } = await params
  const body = await req.json() as { weekStart?: string }
  const { weekStart } = body

  if (!weekStart) {
    return NextResponse.json({ error: "weekStart is required" }, { status: 400 })
  }

  const now = new Date().toISOString()

  // TODO: copy all shifts to new schedule, log SchedulingEvent
  // const source = await db.schedule.findUnique({
  //   where: { id: scheduleId, organizationId: orgId },
  //   include: { shifts: true },
  // })
  // if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 })
  // const newSchedule = await db.schedule.create({
  //   data: { organizationId: orgId, weekStart: new Date(weekStart), isDuplicate: true, sourceScheduleId: scheduleId },
  // })
  // const weekDiff = new Date(weekStart).getTime() - source.weekStart.getTime()
  // await db.shift.createMany({
  //   data: source.shifts.map((shift) => ({
  //     scheduleId: newSchedule.id,
  //     organizationId: orgId,
  //     employeeId: shift.employeeId,
  //     date: new Date(shift.date.getTime() + weekDiff),
  //     startTime: shift.startTime,
  //     endTime: shift.endTime,
  //     breakMinutes: shift.breakMinutes,
  //     jobRole: shift.jobRole,
  //     notes: shift.notes,
  //     colorTag: shift.colorTag,
  //   })),
  // })
  // await db.schedulingEvent.create({
  //   data: { organizationId: orgId, eventType: "SCHEDULE_DUPLICATED",
  //     payload: { sourceScheduleId: scheduleId, newScheduleId: newSchedule.id, weekStart } },
  // })

  const mockDuplicate: Schedule = {
    id: `sched_mock_${Date.now()}`,
    organizationId: orgId,
    weekStart,
    isDuplicate: true,
    sourceScheduleId: scheduleId,
    createdAt: now,
    updatedAt: now,
  }

  return NextResponse.json({ data: mockDuplicate }, { status: 201 })
}
