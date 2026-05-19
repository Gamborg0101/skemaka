import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { previewCleanup, runCleanupForOrg } from "@/lib/cleanup"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

// Dry-run: returns counts of what would be deleted
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const preview = await previewCleanup(orgId)
  return NextResponse.json({ data: preview })
}

// Run the actual cleanup for this org
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const result = await runCleanupForOrg(orgId)
  console.log(`[cleanup] org=${orgId}`, result)
  return NextResponse.json({ data: result })
}
