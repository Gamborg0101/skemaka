import { test, expect } from "@playwright/test"
import { loginAs } from "./helpers"
import { E2E } from "./fixtures"

/**
 * Invite → claim: an unaffiliated signed-in user redeems an employee invite token
 * and is linked to that org's employee record, gaining employee access. This is
 * the onboarding path for account-less employees.
 */
test("a signed-in user can claim an employee invite", async ({ page }) => {
  await loginAs(page, E2E.claimer)

  const res = await page.request.post("/api/me/claim-invite", {
    data: { token: E2E.inviteToken },
  })
  expect(res.status()).toBe(200)

  const body = await res.json()
  expect(body.data.organizationId).toBe(E2E.orgActive)
})
