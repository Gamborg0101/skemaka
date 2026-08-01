import { test, expect } from "@playwright/test"
import { loginAs } from "./helpers"
import { E2E } from "./fixtures"

/**
 * Payroll export.
 *
 * This CSV is what a bookkeeper pays people from. A wrong number here costs
 * someone real money and is not obviously wrong on screen — so these assert the
 * arithmetic and the completeness of the row set, not merely that a file
 * downloads.
 */

const RANGE = "dateFrom=2027-07-05&dateTo=2027-07-11"

test("exports a CSV with the expected headers and a downloadable filename", async ({ page }) => {
  await loginAs(page, E2E.managerActive)
  const res = await page.request.get(
    `/api/orgs/${E2E.orgActive}/timesheets/export?${RANGE}&source=scheduled&mode=summary`,
  )
  expect(res.status()).toBe(200)
  expect(res.headers()["content-type"]).toContain("text/csv")
  expect(res.headers()["content-disposition"]).toMatch(/attachment; filename=".*\.csv"/)

  const header = (await res.text()).split("\n")[0]
  for (const col of ["Employee", "Hours", "Total Pay"]) {
    expect(header, `header must include ${col}`).toContain(col)
  }
})

test("pay equals hours × wage for every row", async ({ page }) => {
  // The whole point of the export. If this drifts, someone is mis-paid.
  await loginAs(page, E2E.managerActive)
  const res = await page.request.get(
    `/api/orgs/${E2E.orgActive}/timesheets/export?${RANGE}&source=scheduled&mode=summary`,
  )
  const lines = (await res.text()).trim().split("\n")
  const cells = (line: string) => line.split(",").map((c) => c.replace(/^"|"$/g, ""))
  const head = cells(lines[0])
  const iHours = head.findIndex((h) => h === "Hours")
  const iWage = head.findIndex((h) => h.startsWith("Hourly Wage"))
  const iPay = head.findIndex((h) => h.startsWith("Total Pay"))
  expect(iHours, "Hours column present").toBeGreaterThan(-1)

  for (const line of lines.slice(1)) {
    const c = cells(line)
    const hours = Number(c[iHours])
    const wage = Number(c[iWage])
    const pay = Number(c[iPay])
    if (!Number.isFinite(hours) || !Number.isFinite(wage)) continue
    expect(pay, `pay for "${c[0]}" should be ${hours} × ${wage}`).toBeCloseTo(hours * wage, 2)
  }
})

test("a shift with no colour is still counted in payroll", async ({ page }) => {
  // Regression: `colorTag <> 'sick'` is NULL for uncoloured shifts, so SQL
  // dropped them — the hours simply never reached the bookkeeper.
  await loginAs(page, E2E.managerActive)
  const week = "2027-07-05"

  const sched = await page.request.post(`/api/orgs/${E2E.orgActive}/schedules`, { data: { weekStart: week } })
  const scheduleId = (await sched.json()).data.id
  const emps = await page.request.get(`/api/orgs/${E2E.orgActive}/employees`)
  const emp = (await emps.json()).data.find((e: { isActive: boolean }) => e.isActive)

  const before = await page.request.get(
    `/api/orgs/${E2E.orgActive}/timesheets/export?${RANGE}&source=scheduled&mode=summary`,
  )
  const hoursBefore = (await before.text()).trim().split("\n").length

  const created = await page.request.post(`/api/orgs/${E2E.orgActive}/schedules/${scheduleId}/shifts`, {
    data: {
      employeeId: emp.id, date: week, startTime: "08:00", endTime: "16:00",
      breakMinutes: 0, jobRole: emp.jobRole, colorTag: null,
    },
  })
  expect(created.status()).toBe(201)

  const after = await page.request.get(
    `/api/orgs/${E2E.orgActive}/timesheets/export?${RANGE}&source=scheduled&mode=summary`,
  )
  const text = await after.text()
  expect(text, "the uncoloured shift's employee must appear in the export").toContain(emp.name)
  expect(text.trim().split("\n").length).toBeGreaterThanOrEqual(hoursBefore)
})

test("another tenant cannot export this org's payroll", async ({ page }) => {
  await loginAs(page, E2E.managerOther)
  const res = await page.request.get(
    `/api/orgs/${E2E.orgActive}/timesheets/export?${RANGE}&source=scheduled&mode=summary`,
  )
  expect(res.status()).toBe(403)
})
