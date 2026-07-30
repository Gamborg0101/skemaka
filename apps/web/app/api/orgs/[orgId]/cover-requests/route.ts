import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as coverService from "@/lib/services/coverService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const CreateCoverSchema = z.object({
  shiftId: z.string().min(1, "shiftId is required"),
  note:    z.string().max(500, "note must be at most 500 characters").nullable().optional(),
})

// GET ?scope=manager → pending requests for the manager to review.
// GET (default)       → { pool, mine } for the current employee.
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const scope = req.nextUrl.searchParams.get("scope")
  if (scope === "manager") {
    const managerCheck = requireManagerRole(guard)
    if (managerCheck) return managerCheck.error
    const data = await coverService.listPendingForManager(orgId)
    return NextResponse.json({ data })
  }

  try {
    const data = await coverService.listForEmployee(orgId, guard.userId)
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}

// POST — an employee offers up one of their own shifts for cover.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(req, CreateCoverSchema)
  if ("error" in parsed) return parsed.error

  try {
    const data = await coverService.createCoverRequest(
      orgId,
      guard.userId,
      parsed.data.shiftId,
      parsed.data.note ?? null,
    )
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
