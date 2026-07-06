import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { isValidColorTag } from "@/lib/validate"
import * as orgService from "@/lib/services/orgService"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const roles = await orgService.listRoles(orgId)
  return NextResponse.json(
    { data: roles },
    { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" } },
  )
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  let body: { name?: string; color?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 })
  if (!body.color?.trim()) return NextResponse.json({ error: "color is required" }, { status: 400 })
  if (body.name.trim().length > 100) return NextResponse.json({ error: "name must be at most 100 characters" }, { status: 400 })
  if (!isValidColorTag(body.color.trim())) return NextResponse.json({ error: "Invalid color" }, { status: 400 })

  try {
    const role = await orgService.createJobRole(orgId, body.name.trim(), body.color.trim())
    return NextResponse.json({ data: role }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    throw err
  }
}
