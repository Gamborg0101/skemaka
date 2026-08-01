import { test, expect } from "@playwright/test"
import { loginAs } from "./helpers"
import { E2E } from "./fixtures"

/**
 * The employee limit.
 *
 * A plan covers N employees; adding beyond that is refused with 402 until the
 * plan is increased. Two ways this fails expensively: letting an org exceed what
 * it pays for (revenue quietly lost), or blocking an org that has room (a
 * customer who cannot use what they bought).
 *
 * Reactivation is covered explicitly because it was missed in the original
 * design — `UpdateEmployeeInput` carries `isActive` and writes it straight
 * through, so "reactivate" was a way past a guard placed only on create.
 */

let created = 0
async function addEmployee(page: import("@playwright/test").Page, orgId: string) {
  return page.request.post(`/api/orgs/${orgId}/employees`, {
    data: {
      name: `Cap Probe ${++created}`,
      email: `cap-probe-${Date.now()}-${created}@e2e.test`,
      jobRole: "Barista",
      hourlyWage: 100,
    },
  })
}

async function activeCount(page: import("@playwright/test").Page, orgId: string) {
  const res = await page.request.get(`/api/orgs/${orgId}/employees`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  return (body.data as { isActive: boolean }[]).filter((e) => e.isActive).length
}

test("blocks the add that would exceed the plan, and says how to fix it", async ({ page }) => {
  await loginAs(page, E2E.managerActive)

  const seatsRes = await page.request.get(`/api/orgs/${E2E.orgActive}/billing/seats`)
  expect(seatsRes.status()).toBe(200)
  const { seats } = (await seatsRes.json()).data as { seats: number }

  // Fill every remaining place.
  let active = await activeCount(page, E2E.orgActive)
  while (active < seats) {
    const res = await addEmployee(page, E2E.orgActive)
    expect(res.status(), `add while ${active}/${seats} used must succeed`).toBe(201)
    active++
  }

  // The next one must be refused.
  const over = await addEmployee(page, E2E.orgActive)
  expect(over.status()).toBe(402)
  const body = await over.json()
  expect(body.code).toBe("SEAT_LIMIT")
  // The message is the entire remedy the manager gets — assert it is actionable.
  expect(body.error).toMatch(new RegExp(`${seats} employees`))
  expect(body.error.toLowerCase()).toContain("increase your plan")

  expect(await activeCount(page, E2E.orgActive), "nothing was created past the cap").toBe(seats)
})

test("deactivating frees a place, and reactivating at the cap is refused", async ({ page }) => {
  await loginAs(page, E2E.managerActive)

  const list = await page.request.get(`/api/orgs/${E2E.orgActive}/employees`)
  const victim = (await list.json()).data.find((e: { isActive: boolean }) => e.isActive)
  expect(victim).toBeTruthy()

  const off = await page.request.patch(`/api/orgs/${E2E.orgActive}/employees/${victim.id}`, {
    data: { isActive: false },
  })
  expect(off.status()).toBe(200)

  // The freed place is usable…
  const fits = await addEmployee(page, E2E.orgActive)
  expect(fits.status(), "a freed place must be usable").toBe(201)

  // …and reactivating now would exceed the cap, so it must be refused. This is
  // the path a guard placed only on create would miss entirely.
  const back = await page.request.patch(`/api/orgs/${E2E.orgActive}/employees/${victim.id}`, {
    data: { isActive: true },
  })
  expect(back.status(), "reactivation must be seat-checked like creation").toBe(402)
})

test("seat state is not readable across tenants", async ({ page }) => {
  await loginAs(page, E2E.managerOther)
  const res = await page.request.get(`/api/orgs/${E2E.orgActive}/billing/seats`)
  expect(res.status()).toBe(403)
})
