import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as orgService from "@/lib/services/orgService"

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  const { success } = await rateLimitRequest(getClientIp(req.headers))
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const body = await req.json() as { name?: string; currency?: string }
  const { name, currency } = body

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  try {
    const org = await orgService.createOrg(guard.userId, name, currency)
    return NextResponse.json({ data: org }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    console.error("[orgs POST]", err)
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 })
  }
}
