import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember } from "@/lib/apiGuard"
import { isValidDate } from "@/lib/validate"
import * as scheduleService from "@/lib/services/scheduleService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error

  const weekStart = req.nextUrl.searchParams.get("weekStart")
  if (!weekStart) {
    return NextResponse.json({ error: "weekStart query param is required" }, { status: 400 })
  }
  if (!isValidDate(weekStart)) {
    return NextResponse.json({ error: "weekStart must be a valid YYYY-MM-DD date" }, { status: 400 })
  }

  if (req.nextUrl.searchParams.get("format") === "csv") {
    const csv = await scheduleService.getLaborCostsCsv(orgId, weekStart)
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payroll-${weekStart}.csv"`,
      },
    })
  }

  const result = await scheduleService.getLaborCosts(orgId, weekStart)
  return NextResponse.json(
    { data: result },
    { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=120" } },
  )
}
