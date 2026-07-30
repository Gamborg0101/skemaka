import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { isValidDate } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as scheduleService from "@/lib/services/scheduleService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const RollOutSchema = z
  .object({
    fromWeek: z.string().refine(isValidDate, "fromWeek and toWeek must be valid YYYY-MM-DD dates"),
    toWeek:   z.string().refine(isValidDate, "fromWeek and toWeek must be valid YYYY-MM-DD dates"),
  })
  .refine((b) => b.toWeek >= b.fromWeek, {
    message: "toWeek must be on or after fromWeek",
    path: ["toWeek"],
  })

/** GET — the draft weeks (with shifts) available to roll out. */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const weeks = await scheduleService.getPendingRollout(orgId)
  return NextResponse.json({ data: weeks }, { headers: { "Cache-Control": "no-store" } })
}

/** POST { fromWeek, toWeek } — roll out every draft week in the range. */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(req, RollOutSchema)
  if ("error" in parsed) return parsed.error
  const body = parsed.data

  try {
    const result = await scheduleService.rollOut(orgId, body.fromWeek, body.toWeek)
    return NextResponse.json({ data: result })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
