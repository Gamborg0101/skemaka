import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { isNonNegativeInt } from "@/lib/validate"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as clockService from "@/lib/services/clockService"

interface RouteContext {
  params: Promise<{ orgId: string; entryId: string }>
}

// PATCH /api/orgs/[orgId]/time-entries/[entryId]
// Manager only. Correct an existing entry (timestamps, break, shift, note).
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId, entryId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  if (guard.role !== "MANAGER" && guard.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as {
    clockIn?: string; clockOut?: string | null
    breakMinutes?: number; shiftId?: string | null; note?: string | null
  }

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  // Validate ISO timestamp strings
  if (body.clockIn !== undefined) {
    const t = new Date(body.clockIn)
    if (isNaN(t.getTime())) {
      return NextResponse.json({ error: "clockIn must be a valid ISO 8601 timestamp" }, { status: 400 })
    }
  }
  if (body.clockOut !== undefined && body.clockOut !== null) {
    const t = new Date(body.clockOut)
    if (isNaN(t.getTime())) {
      return NextResponse.json({ error: "clockOut must be a valid ISO 8601 timestamp or null" }, { status: 400 })
    }
  }
  if (body.breakMinutes !== undefined && !isNonNegativeInt(body.breakMinutes)) {
    return NextResponse.json({ error: "breakMinutes must be a non-negative integer" }, { status: 400 })
  }

  try {
    const entry = await clockService.adminUpdateEntry(orgId, entryId, body)
    return NextResponse.json({ data: entry })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}

// DELETE /api/orgs/[orgId]/time-entries/[entryId]
// Manager only. Permanently removes a time entry.
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { orgId, entryId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  if (guard.role !== "MANAGER" && guard.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    await clockService.adminDeleteEntry(orgId, entryId)
    return NextResponse.json({ data: null })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
