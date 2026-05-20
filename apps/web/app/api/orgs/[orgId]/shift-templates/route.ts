import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { isValidColorTag } from "@/lib/validate"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as orgService from "@/lib/services/orgService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

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

  const body = await req.json() as {
    name?: string; startTime?: string; endTime?: string
    breakMinutes?: number; jobRole?: string; colorTag?: string | null
  }
  const { name, startTime, endTime, breakMinutes, jobRole, colorTag } = body

  if (!name?.trim() || !startTime || !endTime) {
    return NextResponse.json(
      { error: "name, startTime, and endTime are required" },
      { status: 400 },
    )
  }
  if (!isValidColorTag(colorTag)) {
    return NextResponse.json({ error: "Invalid colorTag" }, { status: 400 })
  }

  try {
    const template = await orgService.createShiftTemplate(orgId, {
      name: name.trim(), startTime, endTime, breakMinutes, jobRole, colorTag,
    })
    return NextResponse.json({ data: template }, { status: 201 })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
