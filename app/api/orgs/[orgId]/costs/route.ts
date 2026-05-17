import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { serEmployee, serShift } from "@/lib/serialize"
import { calcHours } from "@/lib/dateUtils"
import type { WeeklyLaborCost, LaborCostEntry } from "@/types"
import { isValidDate } from "@/lib/validate"

const SHIFT_EMPLOYEE_SELECT = {
  id: true, organizationId: true, userId: true,
  name: true, email: true, phone: true, jobRole: true,
  hourlyWage: true, employmentType: true, contractedHours: true,
  notes: true, isActive: true, createdAt: true, updatedAt: true,
} as const

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const weekStart = req.nextUrl.searchParams.get("weekStart")
  if (!weekStart) {
    return NextResponse.json({ error: "weekStart query param is required" }, { status: 400 })
  }
  if (!isValidDate(weekStart)) {
    return NextResponse.json({ error: "weekStart must be a valid YYYY-MM-DD date" }, { status: 400 })
  }

  const schedule = await db.schedule.findFirst({
    where: { organizationId: orgId, weekStart: new Date(weekStart + "T00:00:00Z") },
    include: {
      shifts: {
        where: { colorTag: { not: "sick" } },
        include: { employee: { select: SHIFT_EMPLOYEE_SELECT } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      },
    },
    orderBy: { createdAt: "asc" },
  })

  const shifts = schedule?.shifts ?? []
  const employeeMap = new Map<string, LaborCostEntry>()

  for (const shift of shifts) {
    const hours = calcHours(shift.startTime, shift.endTime, shift.breakMinutes)
    const emp = serEmployee(shift.employee)

    if (!employeeMap.has(shift.employeeId)) {
      employeeMap.set(shift.employeeId, { employee: emp, totalHours: 0, totalCost: 0, shifts: [] })
    }

    const entry = employeeMap.get(shift.employeeId)!
    entry.totalHours = Math.round((entry.totalHours + hours) * 100) / 100
    entry.totalCost = Math.round((entry.totalCost + hours * emp.hourlyWage) * 100) / 100
    entry.shifts.push(serShift(shift))
  }

  const entries = Array.from(employeeMap.values())
  const result: WeeklyLaborCost = {
    weekStart,
    totalHours: Math.round(entries.reduce((s, e) => s + e.totalHours, 0) * 100) / 100,
    totalCost: Math.round(entries.reduce((s, e) => s + e.totalCost, 0) * 100) / 100,
    entries,
  }

  if (req.nextUrl.searchParams.get("format") === "csv") {
    const org = await db.organization.findUnique({ where: { id: orgId }, select: { currency: true } })
    const currency = org?.currency ?? "EUR"
    const rows = [
      ["Employee", "Job Role", "Employment Type", "Contracted Hours", "Scheduled Hours", "Days Worked", `Hourly Wage (${currency})`, `Total Pay (${currency})`],
      ...entries.map((e) => [
        e.employee.name,
        e.employee.jobRole,
        e.employee.employmentType,
        e.employee.contractedHours,
        e.totalHours,
        new Set(e.shifts.map((s) => s.date)).size,
        e.employee.hourlyWage,
        e.totalCost,
      ]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payroll-${weekStart}.csv"`,
      },
    })
  }

  return NextResponse.json(
    { data: result },
    { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=120" } }
  )
}
