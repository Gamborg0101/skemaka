import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/prisma"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import { changeSeats } from "@/lib/services/billingService"
import { MIN_SEATS, minimumSeatsFor } from "@/lib/services/seats"
import { logError, requestIdFrom } from "@/lib/log"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const SeatsSchema = z.object({
  seats: z.number().int().min(MIN_SEATS).max(500),
})

/** Current seat state — what the billing page renders its picker from. */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req, { allowSuspended: true })
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const [org, activeEmployees] = await Promise.all([
    db.organization.findUnique({
      where: { id: orgId },
      select: { seats: true, pendingSeats: true, pendingSeatsEffectiveAt: true },
    }),
    db.employee.count({ where: { organizationId: orgId, isActive: true } }),
  ])
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

  return NextResponse.json({
    data: {
      seats: org.seats,
      pendingSeats: org.pendingSeats,
      pendingSeatsEffectiveAt: org.pendingSeatsEffectiveAt?.toISOString() ?? null,
      activeEmployees,
      // The floor the picker must not go below, so the UI can explain WHY
      // rather than only rejecting the attempt.
      minSeats: minimumSeatsFor(activeEmployees),
    },
  })
}

/**
 * Change the seat count.
 *
 * Increases apply at once and add a flat month per seat to the next invoice;
 * reductions are scheduled for the end of the current period. Reducing below the
 * active-employee count is refused with a CONFLICT naming how many to
 * deactivate — we never deactivate anyone automatically.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req, { allowSuspended: true })
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(req, SeatsSchema)
  if ("error" in parsed) return parsed.error

  try {
    const result = await changeSeats(orgId, parsed.data.seats)
    return NextResponse.json({ data: result })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: serviceErrorStatus(err.code) },
      )
    }
    logError("billing/seats", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to change seats" }, { status: 500 })
  }
}
