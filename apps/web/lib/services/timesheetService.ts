import { db } from "@/lib/prisma"
import { calcHours } from "@/lib/dateUtils"
import { ServiceError } from "./errors"

export type TimesheetSource = "scheduled" | "clocked"
export type TimesheetView = "summary" | "detail"

const MAX_RANGE_DAYS = 366

interface TimesheetRow {
  employeeId: string
  employeeName: string
  employeeEmail: string
  jobRole: string
  employmentType: string
  contractedHours: number
  hourlyWage: number
  date: string // YYYY-MM-DD
  start: string // HH:MM
  end: string // HH:MM ("" for open clock entries — excluded upstream)
  breakMinutes: number
  hours: number
  note: string
}

const round2 = (n: number) => Math.round(n * 100) / 100

function assertRange(dateFrom: string, dateTo: string) {
  const from = new Date(dateFrom + "T00:00:00Z")
  const to = new Date(dateTo + "T00:00:00Z")
  if (to < from) throw new ServiceError("dateTo must not be before dateFrom", "BAD_REQUEST")
  const days = (to.getTime() - from.getTime()) / 86_400_000
  if (days > MAX_RANGE_DAYS) {
    throw new ServiceError(`Date range must be at most ${MAX_RANGE_DAYS} days`, "BAD_REQUEST")
  }
}

const ROW_EMPLOYEE_SELECT = {
  id: true, name: true, email: true, jobRole: true,
  employmentType: true, contractedHours: true, hourlyWage: true,
} as const

type RowEmployee = {
  id: string; name: string; email: string; jobRole: string
  employmentType: string; contractedHours: number
  hourlyWage: { toNumber(): number } | number
}

function baseRow(emp: RowEmployee) {
  return {
    employeeId: emp.id,
    employeeName: emp.name,
    employeeEmail: emp.email,
    jobRole: emp.jobRole,
    employmentType: emp.employmentType,
    contractedHours: emp.contractedHours,
    hourlyWage: typeof emp.hourlyWage === "number" ? emp.hourlyWage : emp.hourlyWage.toNumber(),
  }
}

async function scheduledRows(orgId: string, dateFrom: string, dateTo: string): Promise<TimesheetRow[]> {
  const shifts = await db.shift.findMany({
    where: {
      organizationId: orgId,
      date: {
        gte: new Date(dateFrom + "T00:00:00Z"),
        lte: new Date(dateTo + "T00:00:00Z"),
      },
      // Sick shifts carry no worked hours — mirrors getLaborCosts.
      colorTag: { not: "sick" },
    },
    include: { employee: { select: ROW_EMPLOYEE_SELECT } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  })

  return shifts.map((shift) => ({
    ...baseRow(shift.employee),
    date: shift.date.toISOString().slice(0, 10),
    start: shift.startTime,
    end: shift.endTime,
    breakMinutes: shift.breakMinutes,
    hours: calcHours(shift.startTime, shift.endTime, shift.breakMinutes),
    note: shift.notes ?? "",
  }))
}

async function clockedRows(
  orgId: string,
  dateFrom: string,
  dateTo: string,
  timezone: string,
): Promise<TimesheetRow[]> {
  const entries = await db.timeEntry.findMany({
    where: {
      organizationId: orgId,
      clockOut: { not: null }, // open entries have no worked duration yet
      clockIn: {
        gte: new Date(dateFrom + "T00:00:00Z"),
        lte: new Date(dateTo + "T23:59:59Z"),
      },
    },
    include: { employee: { select: ROW_EMPLOYEE_SELECT } },
    orderBy: { clockIn: "asc" },
  })

  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  })
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false,
  })

  return entries.map((entry) => {
    const grossMs = entry.clockOut!.getTime() - entry.clockIn.getTime()
    const netHours = Math.max(0, grossMs / 3_600_000 - entry.breakMinutes / 60)
    return {
      ...baseRow(entry.employee),
      date: dateFmt.format(entry.clockIn),
      start: timeFmt.format(entry.clockIn),
      end: timeFmt.format(entry.clockOut!),
      breakMinutes: entry.breakMinutes,
      hours: round2(netHours),
      note: entry.note ?? "",
    }
  })
}

const q = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`
const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(q).join(",")).join("\n")

function summaryCsv(rows: TimesheetRow[], currency: string): string {
  const byEmployee = new Map<string, { row: TimesheetRow; hours: number; pay: number; days: Set<string> }>()
  for (const row of rows) {
    let agg = byEmployee.get(row.employeeId)
    if (!agg) {
      agg = { row, hours: 0, pay: 0, days: new Set() }
      byEmployee.set(row.employeeId, agg)
    }
    agg.hours += row.hours
    agg.pay += row.hours * row.hourlyWage
    agg.days.add(row.date)
  }

  const sorted = Array.from(byEmployee.values()).sort((a, b) =>
    a.row.employeeName.localeCompare(b.row.employeeName),
  )
  return toCsv([
    ["Employee", "Email", "Job Role", "Employment Type", "Contracted Hours", "Days Worked", "Hours", `Hourly Wage (${currency})`, `Total Pay (${currency})`],
    ...sorted.map(({ row, hours, pay, days }) => [
      row.employeeName, row.employeeEmail, row.jobRole, row.employmentType,
      row.contractedHours, days.size, round2(hours), row.hourlyWage, round2(pay),
    ]),
  ])
}

function detailCsv(rows: TimesheetRow[], currency: string): string {
  const sorted = [...rows].sort(
    (a, b) => a.employeeName.localeCompare(b.employeeName) || a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
  )
  return toCsv([
    ["Employee", "Date", "Start", "End", "Break (min)", "Hours", `Hourly Wage (${currency})`, `Pay (${currency})`, "Note"],
    ...sorted.map((row) => [
      row.employeeName, row.date, row.start, row.end, row.breakMinutes,
      row.hours, row.hourlyWage, round2(row.hours * row.hourlyWage), row.note,
    ]),
  ])
}

/**
 * Payroll-ready timesheet CSV over an arbitrary date range (both bounds inclusive).
 *
 * source "scheduled" — hours from rostered shifts (orgs that pay by the roster)
 * source "clocked"   — hours from completed clock in/out entries, net of breaks
 * view   "summary"   — one row per employee (totals for the pay period)
 * view   "detail"    — one row per shift / time entry
 */
export async function getTimesheetCsv(
  orgId: string,
  dateFrom: string,
  dateTo: string,
  source: TimesheetSource,
  view: TimesheetView,
): Promise<string> {
  assertRange(dateFrom, dateTo)

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { currency: true, timezone: true },
  })
  const currency = org?.currency ?? "EUR"
  const timezone = org?.timezone ?? "UTC"

  const rows = source === "scheduled"
    ? await scheduledRows(orgId, dateFrom, dateTo)
    : await clockedRows(orgId, dateFrom, dateTo, timezone)

  return view === "summary" ? summaryCsv(rows, currency) : detailCsv(rows, currency)
}
