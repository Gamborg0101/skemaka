import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { calcHours } from "@/lib/dateUtils"
import type { WeeklyLaborCost, LaborCostEntry, Employee, Shift } from "@/types"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const weekStart = req.nextUrl.searchParams.get("weekStart")

  if (!weekStart) {
    return NextResponse.json({ error: "weekStart query param is required" }, { status: 400 })
  }

  // TODO: replace with DB query
  // const schedule = await db.schedule.findFirst({
  //   where: { organizationId: orgId, weekStart: new Date(weekStart) },
  //   include: { shifts: { include: { employee: true } } },
  // })
  // const entries = Object.values(
  //   (schedule?.shifts ?? []).reduce<Record<string, LaborCostEntry>>((acc, shift) => {
  //     const hours = calcHours(shift.startTime, shift.endTime, shift.breakMinutes)
  //     const wage = Number(shift.employee.hourlyWage)
  //     if (!acc[shift.employeeId]) {
  //       acc[shift.employeeId] = { employee: shift.employee, totalHours: 0, totalCost: 0, shifts: [] }
  //     }
  //     acc[shift.employeeId].totalHours += hours
  //     acc[shift.employeeId].totalCost += hours * wage
  //     acc[shift.employeeId].shifts.push(shift)
  //     return acc
  //   }, {})
  // )

  const mockEmployee1: Employee = {
    id: "emp_mock_001",
    organizationId: orgId,
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

  const mockEmployee2: Employee = {
    id: "emp_mock_002",
    organizationId: orgId,
    userId: null,
    name: "Bob Eriksen",
    email: "bob@example.com",
    phone: null,
    jobRole: "Cashier",
    hourlyWage: 145,
    notes: null,
    employmentType: "PART_TIME" as const,
      contractedHours: 0,
      isActive: true,
    inviteToken: null,
    inviteExpiry: null,
    createdAt: "2025-01-02T08:00:00.000Z",
    updatedAt: "2025-01-02T08:00:00.000Z",
  }

  const mockShift1: Shift = {
    id: "shift_mock_001",
    scheduleId: "sched_mock_001",
    organizationId: orgId,
    employeeId: "emp_mock_001",
    date: weekStart,
    startTime: "08:00",
    endTime: "16:00",
    breakMinutes: 30,
    jobRole: "Barista",
    notes: null,
    colorTag: "#3b82f6",
    createdAt: "2025-05-10T09:00:00.000Z",
    updatedAt: "2025-05-10T09:00:00.000Z",
  }

  const mockShift2: Shift = {
    id: "shift_mock_002",
    scheduleId: "sched_mock_001",
    organizationId: orgId,
    employeeId: "emp_mock_002",
    date: weekStart,
    startTime: "10:00",
    endTime: "18:00",
    breakMinutes: 30,
    jobRole: "Cashier",
    notes: null,
    colorTag: "#10b981",
    createdAt: "2025-05-10T09:00:00.000Z",
    updatedAt: "2025-05-10T09:00:00.000Z",
  }

  const hours1 = calcHours(mockShift1.startTime, mockShift1.endTime, mockShift1.breakMinutes)
  const hours2 = calcHours(mockShift2.startTime, mockShift2.endTime, mockShift2.breakMinutes)

  const entries: LaborCostEntry[] = [
    {
      employee: mockEmployee1,
      totalHours: hours1,
      totalCost: hours1 * mockEmployee1.hourlyWage,
      shifts: [mockShift1],
    },
    {
      employee: mockEmployee2,
      totalHours: hours2,
      totalCost: hours2 * mockEmployee2.hourlyWage,
      shifts: [mockShift2],
    },
  ]

  const totalHours = entries.reduce((sum, e) => sum + e.totalHours, 0)
  const totalCost = entries.reduce((sum, e) => sum + e.totalCost, 0)

  const result: WeeklyLaborCost = {
    weekStart,
    totalHours,
    totalCost,
    entries,
  }

  return NextResponse.json({ data: result })
}
