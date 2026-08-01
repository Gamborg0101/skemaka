import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { isValidEmail } from "@/lib/validate"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as orgService from "@/lib/services/orgService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const AddTeamMemberSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Email is required").refine(isValidEmail, "email must be a valid email address"),
})

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const members = await orgService.listTeam(orgId)
  return NextResponse.json(
    { data: members },
    { headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=600" } },
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

  const parsed = await parseBody(req, AddTeamMemberSchema)
  if ("error" in parsed) return parsed.error

  try {
    const member = await orgService.addTeamMember(orgId, guard.userId, parsed.data.email)
    return NextResponse.json({ data: member }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
