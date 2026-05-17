import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { serSchedule } from "@/lib/serialize"
import { isValidDate } from "@/lib/validate"
import { Prisma } from "@/app/generated/prisma/client"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const weekStart = req.nextUrl.searchParams.get("weekStart")

  if (weekStart) {
    if (!isValidDate(weekStart)) {
      return NextResponse.json({ error: "weekStart must be a valid YYYY-MM-DD date" }, { status: 400 })
    }
    const schedule = await db.schedule.findFirst({
      where: { organizationId: orgId, weekStart: new Date(weekStart + "T00:00:00Z") },
      include: { shifts: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json(
      { data: schedule ? serSchedule(schedule) : null },
      { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=120" } }
    )
  }

  const schedules = await db.schedule.findMany({
    where: { organizationId: orgId },
    orderBy: { weekStart: "desc" },
  })

  return NextResponse.json(
    { data: schedules.map(serSchedule) },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } }
  )
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
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

  const weekStartDate = new Date(weekStart + "T00:00:00Z")

  const existing = await db.schedule.findFirst({
    where: { organizationId: orgId, weekStart: weekStartDate },
    include: { shifts: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } },
    orderBy: { createdAt: "asc" },
  })

  if (existing) {
    return NextResponse.json({ data: serSchedule(existing) })
  }

  try {
    const schedule = await db.schedule.create({
      data: { organizationId: orgId, weekStart: weekStartDate },
      include: { shifts: true },
    })
    return NextResponse.json({ data: serSchedule(schedule) }, { status: 201 })
  } catch (err) {
    // Concurrent POST won the race — return the existing schedule instead of crashing.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const schedule = await db.schedule.findFirst({
        where: { organizationId: orgId, weekStart: weekStartDate },
        include: { shifts: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } },
        orderBy: { createdAt: "asc" },
      })
      return NextResponse.json({ data: serSchedule(schedule!) })
    }
    throw err
  }
}
