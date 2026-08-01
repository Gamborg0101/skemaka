import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMember, requireManagerRole, parseBody } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { isValidColorTag } from "@/lib/validate"
import * as orgService from "@/lib/services/orgService"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"

interface RouteContext {
  params: Promise<{ orgId: string; roleId: string }>
}

const UpdateRoleSchema = z
  .object({
    name:  z.string().trim().min(1, "name must be a non-empty string").max(100, "name must be at most 100 characters").optional(),
    color: z.string().refine(isValidColorTag, "Invalid color").optional(),
  })
  .refine((b) => b.name !== undefined || b.color !== undefined, {
    message: "Provide a name and/or color to update",
  })

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId, roleId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(req, UpdateRoleSchema)
  if ("error" in parsed) return parsed.error

  try {
    const role = await orgService.updateJobRole(orgId, roleId, {
      ...(parsed.data.name  !== undefined ? { name: parsed.data.name }   : {}),
      ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
    })
    return NextResponse.json({ data: role })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { orgId, roleId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success: deleteOk } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!deleteOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  try {
    await orgService.deleteJobRole(orgId, roleId)
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
