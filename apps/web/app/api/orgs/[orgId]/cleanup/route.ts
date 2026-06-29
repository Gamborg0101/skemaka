import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { previewCleanup, runCleanupForOrg } from "@/lib/cleanup"
import { logInfo, requestIdFrom } from "@/lib/log"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

// Dry-run: returns counts of what would be deleted
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const preview = await previewCleanup(orgId)
  return NextResponse.json({ data: preview })
}

// Run the actual cleanup for this org
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const result = await runCleanupForOrg(orgId)
  logInfo("cleanup", "org cleanup completed", { orgId, result, requestId: requestIdFrom(req.headers) })
  return NextResponse.json({ data: result })
}
