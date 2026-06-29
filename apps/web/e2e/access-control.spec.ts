import { test, expect } from "@playwright/test"
import { loginAs } from "./helpers"
import { E2E } from "./fixtures"

/**
 * The money path's enforcement surface: an active org has access, an expired
 * trial is paywalled (402), and one tenant can never reach another's data (403).
 * These are the outcomes that paying-customer billing and tenant isolation hinge
 * on — the flows that lose money or leak data if they regress.
 */

test("active subscription org can access its data", async ({ page }) => {
  await loginAs(page, E2E.managerActive)
  const res = await page.request.get(`/api/orgs/${E2E.orgActive}/me`)
  expect(res.status()).toBe(200)
})

test("expired trial is paywalled with 402", async ({ page }) => {
  await loginAs(page, E2E.managerExpired)
  const res = await page.request.get(`/api/orgs/${E2E.orgExpired}/me`)
  expect(res.status()).toBe(402)
  const body = await res.json()
  expect(body.code).toBe("TRIAL_EXPIRED")
})

test("cross-tenant access is denied with 403", async ({ page }) => {
  await loginAs(page, E2E.managerActive)
  // Manager A reaching into Org B must be rejected.
  const res = await page.request.get(`/api/orgs/${E2E.orgOther}/me`)
  expect(res.status()).toBe(403)
})
