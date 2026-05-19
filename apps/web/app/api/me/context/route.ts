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

  return NextResponse.json(
    { data: ctx },
    { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" } },
  )
}
