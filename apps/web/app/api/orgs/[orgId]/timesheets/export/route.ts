import { NextRequest, NextResponse } from "next/server"
import { requireOrgMember, requireManagerRole } from "@/lib/apiGuard"
import { isValidDate } from "@/lib/validate"
import { ServiceError, serviceErrorStatus } from "@/lib/services/errors"
import * as timesheetService from "@/lib/services/timesheetService"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

// GET /api/orgs/[orgId]/timesheets/export
//   ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD          (inclusive pay period)
//   &source=scheduled|clocked                        (default scheduled)
//   &view=summary|detail                             (default summary)
// Manager-only. Returns a CSV download.
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId, req)
  if ("error" in guard) return guard.error
  const managerCheck = requireManagerRole(guard)
  if (managerCheck) return managerCheck.error

  const dateFrom = req.nextUrl.searchParams.get("dateFrom")
  const dateTo = req.nextUrl.searchParams.get("dateTo")
  if (!dateFrom || !isValidDate(dateFrom)) {
    return NextResponse.json({ error: "dateFrom must be a valid YYYY-MM-DD date" }, { status: 400 })
  }
  if (!dateTo || !isValidDate(dateTo)) {
    return NextResponse.json({ error: "dateTo must be a valid YYYY-MM-DD date" }, { status: 400 })
  }

  const source = req.nextUrl.searchParams.get("source") ?? "scheduled"
  if (source !== "scheduled" && source !== "clocked") {
    return NextResponse.json({ error: "source must be scheduled or clocked" }, { status: 400 })
  }
  const view = req.nextUrl.searchParams.get("view") ?? "summary"
  if (view !== "summary" && view !== "detail") {
    return NextResponse.json({ error: "view must be summary or detail" }, { status: 400 })
  }

  try {
    const csv = await timesheetService.getTimesheetCsv(orgId, dateFrom, dateTo, source, view)
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="timesheet-${source}-${dateFrom}-to-${dateTo}.csv"`,
      },
    })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: serviceErrorStatus(err.code) })
    }
    throw err
  }
}
