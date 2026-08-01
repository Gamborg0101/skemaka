import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as shiftOfferService from "@/lib/services/shiftOfferService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

// Time/date formats are validated inside createShiftOffer (which throws
// ServiceError); here we only enforce the body shape, as the original did.
const CreateShiftOfferSchema = z.object({
  date:         z.string(),
  startTime:    z.string(),
  endTime:      z.string(),
  jobRole:      z.string(),
  breakMinutes: z.number().optional(),
  note:         z.string().max(500, "note must be at most 500 characters").nullable().optional(),
  deadline:     z.string(),
  employeeIds:  z.array(z.string(), { message: "employeeIds must be an array of strings" }),
})

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
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
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

  const parsed = await parseBody(req, CreateShiftOfferSchema)
  if ("error" in parsed) return parsed.error

  try {
    const data = await shiftOfferService.createShiftOffer(orgId, guard.userId, {
      ...parsed.data,
      note: parsed.data.note ?? null,
    })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
