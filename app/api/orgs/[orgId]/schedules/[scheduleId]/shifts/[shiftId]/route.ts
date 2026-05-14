import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { Shift } from "@/types"

interface RouteContext {
  params: Promise<{ orgId: string; scheduleId: string; shiftId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgId, scheduleId, shiftId } = await params

  const body = await req.json() as Partial<
    Pick<Shift, "date" | "startTime" | "endTime" | "breakMinutes" | "jobRole" | "notes" | "colorTag" | "employeeId">
  >

  const now = new Date().toISOString()

  // TODO: replace with DB query
  // const shift = await db.shift.update({
  //   where: { id: shiftId, scheduleId, organizationId: orgId },
  //   data: { ...body, ...(body.date ? { date: new Date(body.date) } : {}), updatedAt: new Date() },
  // })

  const mockShift: Shift = {
    id: shiftId,
    scheduleId,
    organizationId: orgId,
    employeeId: body.employeeId ?? "emp_mock_001",
    date: body.date ?? "2025-05-12",
    startTime: body.startTime ?? "08:00",
    endTime: body.endTime ?? "16:00",
    breakMinutes: body.breakMinutes ?? 30,
    jobRole: body.jobRole ?? "Barista",
    notes: body.notes ?? null,
    colorTag: body.colorTag ?? null,
    createdAt: "2025-05-10T09:00:00.000Z",
    updatedAt: now,
  }

  return NextResponse.json({ data: mockShift })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgId, scheduleId, shiftId } = await params

  // TODO: replace with DB query
  // await db.shift.delete({
  //   where: { id: shiftId, scheduleId, organizationId: orgId },
  // })

  void orgId
  void scheduleId
  void shiftId

  return NextResponse.json({ data: { deleted: true } })
}
