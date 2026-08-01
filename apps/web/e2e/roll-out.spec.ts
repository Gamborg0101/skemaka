import { test, expect } from "@playwright/test"
import { loginAs } from "./helpers"
import { E2E } from "./fixtures"

/**
 * Roll-out: the moment a draft schedule becomes visible to staff.
 *
 * Until a shift is rolled out its `publishedAt` is null and employees cannot see
 * it. A shift that silently never publishes is invisible to everyone — the
 * manager thinks the week is sent, staff never learn they are working. That is
 * the failure this file exists to catch, and it has happened once already: a
 * shift with no colour was dropped by `colorTag <> 'sick'` (NULL is not true in
 * SQL), so it stayed a draft forever with no error anywhere.
 */

const WEEK = "2027-06-07" // a Monday, far from any seeded data

async function createWeek(page: import("@playwright/test").Page, orgId: string) {
  const res = await page.request.post(`/api/orgs/${orgId}/schedules`, {
    data: { weekStart: WEEK },
  })
  expect(res.status(), "creating the week").toBeLessThan(400)
  return (await res.json()).data.id as string
}

async function firstActiveEmployee(page: import("@playwright/test").Page, orgId: string) {
  const res = await page.request.get(`/api/orgs/${orgId}/employees`)
  expect(res.status()).toBe(200)
  const emp = (await res.json()).data.find((e: { isActive: boolean }) => e.isActive)
  expect(emp, "seed must provide an active employee").toBeTruthy()
  return emp as { id: string; jobRole: string }
}

test("a draft shift is not published until it is rolled out", async ({ page }) => {
  await loginAs(page, E2E.managerActive)
  const scheduleId = await createWeek(page, E2E.orgActive)
  const emp = await firstActiveEmployee(page, E2E.orgActive)

  const created = await page.request.post(`/api/orgs/${E2E.orgActive}/schedules/${scheduleId}/shifts`, {
    data: { employeeId: emp.id, date: WEEK, startTime: "09:00", endTime: "17:00", breakMinutes: 0, jobRole: emp.jobRole },
  })
  expect(created.status()).toBe(201)
  expect((await created.json()).data.publishedAt, "new shifts start as drafts").toBeNull()

  const rolled = await page.request.post(`/api/orgs/${E2E.orgActive}/schedules/roll-out`, {
    data: { fromWeek: WEEK, toWeek: WEEK },
  })
  expect(rolled.status()).toBe(200)

  const after = await page.request.get(`/api/orgs/${E2E.orgActive}/schedules?weekStart=${WEEK}`)
  const shifts = (await after.json()).data.shifts as { publishedAt: string | null }[]
  expect(shifts.every((s) => s.publishedAt !== null), "every shift in the week is now published").toBe(true)
})

test("a shift with NO colour still rolls out", async ({ page }) => {
  // Regression: colorTag is nullable and the API accepts null. `colorTag <>
  // 'sick'` evaluates to NULL for those rows, so SQL dropped them and they were
  // never published, never badged as pending, and never reached payroll export.
  await loginAs(page, E2E.managerActive)
  const scheduleId = await createWeek(page, E2E.orgActive)
  const emp = await firstActiveEmployee(page, E2E.orgActive)

  const created = await page.request.post(`/api/orgs/${E2E.orgActive}/schedules/${scheduleId}/shifts`, {
    data: {
      employeeId: emp.id, date: "2027-06-09", startTime: "10:00", endTime: "18:00",
      breakMinutes: 0, jobRole: emp.jobRole, colorTag: null,
    },
  })
  expect(created.status()).toBe(201)
  const shiftId = (await created.json()).data.id as string

  const rolled = await page.request.post(`/api/orgs/${E2E.orgActive}/schedules/roll-out`, {
    data: { fromWeek: WEEK, toWeek: WEEK },
  })
  expect(rolled.status(), "an uncoloured draft must not be invisible to roll-out").toBe(200)

  const after = await page.request.get(`/api/orgs/${E2E.orgActive}/schedules?weekStart=${WEEK}`)
  const mine = (await after.json()).data.shifts.find((s: { id: string }) => s.id === shiftId)
  expect(mine?.publishedAt, "the uncoloured shift must be published").not.toBeNull()
})

test("roll-out rejects a backwards week range", async ({ page }) => {
  await loginAs(page, E2E.managerActive)
  const res = await page.request.post(`/api/orgs/${E2E.orgActive}/schedules/roll-out`, {
    data: { fromWeek: "2027-06-14", toWeek: "2027-06-07" },
  })
  expect(res.status()).toBe(400)
  expect((await res.json()).error).toMatch(/on or after/i)
})

test("roll-out cannot reach another tenant's schedule", async ({ page }) => {
  await loginAs(page, E2E.managerOther)
  const res = await page.request.post(`/api/orgs/${E2E.orgActive}/schedules/roll-out`, {
    data: { fromWeek: WEEK, toWeek: WEEK },
  })
  expect(res.status(), "cross-tenant roll-out must be refused").toBe(403)
})
