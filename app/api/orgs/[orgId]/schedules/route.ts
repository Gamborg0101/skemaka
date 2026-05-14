import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { Schedule } from "@/types"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const mockSchedules: Schedule[] = [
  {
    id: "sched_mock_001",
    organizationId: "org_mock_001",
    weekStart: "2025-05-12",
    isDuplicate: false,
    sourceScheduleId: null,
    createdAt: "2025-05-10T09:00:00.000Z",
    updatedAt: "2025-05-10T09:00:00.000Z",
  },
  {
    id: "sched_mock_002",
    organizationId: "org_mock_001",
    weekStart: "2025-05-05",
    isDuplicate: false,
    sourceScheduleId: null,
    createdAt: "2025-05-03T09:00:00.000Z",
    updatedAt: "2025-05-03T09:00:00.000Z",
  },
]

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params

  // TODO: replace with DB query
  // const schedules = await db.schedule.findMany({
  //   where: { organizationId: orgId },
  //   orderBy: { weekStart: "desc" },
  // })

  const schedules = mockSchedules.filter((s) => s.organizationId === orgId || orgId === "org_mock_001")

  return NextResponse.json({ data: schedules })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params
  const body = await req.json() as { weekStart?: string }
  const { weekStart } = body

  if (!weekStart) {
    return NextResponse.json({ error: "weekStart is required" }, { status: 400 })
  }

  const now = new Date().toISOString()

  // TODO: create Schedule in DB
  // const schedule = await db.schedule.create({
  //   data: { organizationId: orgId, weekStart: new Date(weekStart) },
  // })

  const mockSchedule: Schedule = {
    id: `sched_mock_${Date.now()}`,
    organizationId: orgId,
    weekStart,
    isDuplicate: false,
    sourceScheduleId: null,
    createdAt: now,
    updatedAt: now,
  }

  return NextResponse.json({ data: mockSchedule }, { status: 201 })
}
