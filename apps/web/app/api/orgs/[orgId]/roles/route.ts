import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { isValidColorTag } from "@/lib/validate"
import * as orgService from "@/lib/services/orgService"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const CreateRoleSchema = z.object({
  name:  z.string().trim().min(1, "name is required").max(100, "name must be at most 100 characters"),
  color: z.string().trim().min(1, "color is required").refine(isValidColorTag, "Invalid color"),
})

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

  const parsed = await parseBody(req, CreateRoleSchema)
  if ("error" in parsed) return parsed.error

  try {
    const role = await orgService.createJobRole(orgId, parsed.data.name, parsed.data.color)
    return NextResponse.json({ data: role }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    throw err
  }
}
