import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiGuard"
import * as orgService from "@/lib/services/orgService"

export async function GET(req: NextRequest) {
  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

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
