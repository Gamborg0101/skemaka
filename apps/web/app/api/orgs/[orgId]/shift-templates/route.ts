import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { isValidColorTag } from "@/lib/validate"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as orgService from "@/lib/services/orgService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

// startTime/endTime were never format-checked here (only required) — preserved.
const CreateTemplateSchema = z.object({
  name:         z.string().trim().min(1, "name, startTime, and endTime are required"),
  startTime:    z.string().min(1, "name, startTime, and endTime are required"),
  endTime:      z.string().min(1, "name, startTime, and endTime are required"),
  breakMinutes: z.number().optional(),
  jobRole:      z.string().optional(),
  colorTag:     z.string().refine((s) => isValidColorTag(s), "Invalid colorTag").nullable().optional(),
})

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const templates = await orgService.listShiftTemplates(orgId)
  return NextResponse.json(
    { data: templates },
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

  const parsed = await parseBody(req, CreateTemplateSchema)
  if ("error" in parsed) return parsed.error

  try {
    const template = await orgService.createShiftTemplate(orgId, parsed.data)
    return NextResponse.json({ data: template }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
