import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { isValidDate } from "@/lib/validate"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as scheduleService from "@/lib/services/scheduleService"
import { logError, requestIdFrom } from "@/lib/log"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const GenerateSchema = z.object({
  weekStart: z.string().refine(isValidDate, "weekStart must be a valid YYYY-MM-DD date"),
  mode:      z.enum(["starter", "copyPrevious"], { message: "mode must be 'starter' or 'copyPrevious'" }),
})

/**
 * POST /api/orgs/[orgId]/schedules/generate
 * Body: { weekStart: "YYYY-MM-DD", mode: "starter" | "copyPrevious" }
 *
 * The "magic moment" endpoint — fills an empty week so a manager sees a complete
 * schedule in one click. Manager-only, rate-limited; both modes refuse to
 * overwrite a week that already has shifts.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(req, GenerateSchema)
  if ("error" in parsed) return parsed.error
  const { weekStart, mode } = parsed.data

  try {
    const schedule =
      mode === "copyPrevious"
        ? await scheduleService.copyPreviousWeek(orgId, weekStart)
        : await scheduleService.generateStarterWeek(orgId, weekStart)
    return NextResponse.json({ data: schedule }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    }
    logError("schedules/generate", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to generate schedule" }, { status: 500 })
  }
}
