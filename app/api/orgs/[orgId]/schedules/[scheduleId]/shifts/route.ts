import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { Shift } from "@/types"

interface RouteContext {
  params: Promise<{ orgId: string; scheduleId: string }>
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
  },
  {
    id: "shift_mock_002",
    scheduleId: "sched_mock_001",
    organizationId: "org_mock_001",
    employeeId: "emp_mock_002",
    date: "2025-05-13",
    startTime: "10:00",
    endTime: "18:00",
    breakMinutes: 30,
    jobRole: "Cashier",
    notes: null,
    colorTag: "#10b981",
    createdAt: "2025-05-10T09:00:00.000Z",
    updatedAt: "2025-05-10T09:00:00.000Z",
  },
]

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgId, scheduleId } = await params

  // TODO: replace with DB query
  // const shifts = await db.shift.findMany({
  //   where: { scheduleId, organizationId: orgId },
  //   include: { employee: true },
  //   orderBy: [{ date: "asc" }, { startTime: "asc" }],
  // })

  const shifts = mockShifts.filter((s) => s.scheduleId === scheduleId || scheduleId === "sched_mock_001")
  void orgId

  return NextResponse.json({ data: shifts })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgId, scheduleId } = await params

  const body = await req.json() as {
    employeeId?: string
    date?: string
    startTime?: string
    endTime?: string
    breakMinutes?: number
    jobRole?: string
    notes?: string
    colorTag?: string
  }

  const { employeeId, date, startTime, endTime, breakMinutes, jobRole, notes, colorTag } = body

  if (!employeeId || !date || !startTime || !endTime || !jobRole) {
    return NextResponse.json(
      { error: "employeeId, date, startTime, endTime, and jobRole are required" },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()

  // TODO: replace with DB query
  // const shift = await db.shift.create({
  //   data: { scheduleId, organizationId: orgId, employeeId, date: new Date(date),
  //     startTime, endTime, breakMinutes: breakMinutes ?? 0, jobRole, notes, colorTag },
  // })

  const mockShift: Shift = {
    id: `shift_mock_${Date.now()}`,
    scheduleId,
    organizationId: orgId,
    employeeId,
    date,
    startTime,
    endTime,
    breakMinutes: breakMinutes ?? 0,
    jobRole,
    notes: notes ?? null,
    colorTag: colorTag ?? null,
    createdAt: now,
    updatedAt: now,
  }

  return NextResponse.json({ data: mockShift }, { status: 201 })
}
