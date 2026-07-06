import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiGuard"
import { isSuperadmin, ACTING_ORG_COOKIE } from "@/lib/platform"
import * as orgService from "@/lib/services/orgService"

export async function GET(req: NextRequest) {
  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  // Super-admin "acting-as": when the super admin has picked a restaurant to
  // manage, return THAT restaurant's context so the whole manager UI points at
  // it. The cookie is honored only for the super admin (isSuperadmin gate).
  const actingOrgId = req.cookies.get(ACTING_ORG_COOKIE)?.value
  if (actingOrgId && isSuperadmin(guard.email)) {
    const actingCtx = await orgService.getOrgContextById(actingOrgId)
    if (actingCtx) {
      return NextResponse.json(
        { data: { ...actingCtx, acting: true } },
        { headers: { "Cache-Control": "no-store" } },
      )
    }
    // Stale cookie (org deleted) — fall through to the super admin's own org.
  }

  const ctx = await orgService.getOrgContext(guard.userId)
  if (!ctx) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 })
  }

  // No caching: this endpoint is the single source of truth for "does this user
  // have an org?". A cached response means that right after creating or leaving
  // an org the app reads stale membership state — causing onboarding ⇄ app
  // redirect bounces. Always reflect the live DB.
  return NextResponse.json(
    { data: ctx },
    { headers: { "Cache-Control": "no-store" } },
  )
}
