import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as shiftOfferService from "@/lib/services/shiftOfferService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

// GET ?scope=manager → open offers for the manager to manage.
// GET (default)       → offers addressed to the current employee.
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const scope = req.nextUrl.searchParams.get("scope")
  if (scope === "manager") {
    const managerCheck = requireManagerRole(guard)
    if (managerCheck) return managerCheck.error
    const data = await shiftOfferService.listForManager(orgId)
    return NextResponse.json({ data })
  }

  try {
    const data = await shiftOfferService.listForEmployee(orgId, guard.userId)
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}

// POST — a manager offers a brand-new slot to hand-picked employees.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  let body: {
    date?: unknown; startTime?: unknown; endTime?: unknown; jobRole?: unknown
    breakMinutes?: unknown; note?: unknown; deadline?: unknown; employeeIds?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (typeof body.date !== "string" || typeof body.startTime !== "string" || typeof body.endTime !== "string") {
    return NextResponse.json({ error: "date, startTime and endTime are required" }, { status: 400 })
  }
  if (typeof body.jobRole !== "string") {
    return NextResponse.json({ error: "jobRole is required" }, { status: 400 })
  }
  if (typeof body.deadline !== "string") {
    return NextResponse.json({ error: "deadline is required" }, { status: 400 })
  }
  if (!Array.isArray(body.employeeIds) || !body.employeeIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "employeeIds must be an array of strings" }, { status: 400 })
  }
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") {
    return NextResponse.json({ error: "note must be a string" }, { status: 400 })
  }
  if (typeof body.note === "string" && body.note.length > 500) {
    return NextResponse.json({ error: "note must be at most 500 characters" }, { status: 400 })
  }
  if (body.breakMinutes !== undefined && typeof body.breakMinutes !== "number") {
    return NextResponse.json({ error: "breakMinutes must be a number" }, { status: 400 })
  }

  try {
    const data = await shiftOfferService.createShiftOffer(orgId, guard.userId, {
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      jobRole: body.jobRole,
      breakMinutes: typeof body.breakMinutes === "number" ? body.breakMinutes : undefined,
      note: typeof body.note === "string" ? body.note : null,
      deadline: body.deadline,
      employeeIds: body.employeeIds as string[],
    })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
