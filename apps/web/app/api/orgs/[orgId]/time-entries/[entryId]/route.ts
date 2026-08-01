import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as clockService from "@/lib/services/clockService"

interface RouteContext {
  params: Promise<{ orgId: string; entryId: string }>
}

// A loose "valid Date string" check, matching the previous `new Date(x)` guard —
// accepts any string Date can parse, rejects garbage. At least one field must be
// present, enforced by the object-level refine.
const isoTimestamp = z
  .string()
  .refine((s) => !isNaN(new Date(s).getTime()), "must be a valid ISO 8601 timestamp")

const UpdateEntrySchema = z
  .object({
    clockIn:      isoTimestamp.optional(),
    clockOut:     isoTimestamp.nullable().optional(),
    breakMinutes: z.number().int().min(0, "must be a non-negative integer").optional(),
    shiftId:      z.string().nullable().optional(),
    note:         z.string().nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "No fields to update" })

// PATCH /api/orgs/[orgId]/time-entries/[entryId]
// Manager only. Correct an existing entry (timestamps, break, shift, note).
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId, entryId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const parsed = await parseBody(req, UpdateEntrySchema)
  if ("error" in parsed) return parsed.error

  try {
    const entry = await clockService.adminUpdateEntry(orgId, entryId, parsed.data, guard.userId)
    return NextResponse.json({ data: entry })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
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

  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  try {
    await clockService.adminDeleteEntry(orgId, entryId, guard.userId)
    return NextResponse.json({ data: null })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
