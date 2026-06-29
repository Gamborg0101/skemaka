import { test, expect } from "@playwright/test"
import { loginAs } from "./helpers"
import { E2E } from "./fixtures"

/**
 * Invite → claim: an unaffiliated signed-in user redeems an employee invite token
 * and is linked to that org's employee record, gaining employee access. This is
 * the onboarding path for account-less employees.
 */
// Declared before the happy-path test on purpose: the suite runs serially
// (workers: 1), and the happy-path test below consumes the invite by linking it
// to the claimer. This negative case must run while the invite is still
// unclaimed so a missing code is rejected rather than idempotently re-claimed.
test("claiming without a code is rejected", async ({ page }) => {
  await loginAs(page, E2E.claimer)

  const res = await page.request.post("/api/me/claim-invite", {
    data: { token: E2E.inviteToken },
  })
  expect(res.status()).toBe(400)
})

test("a signed-in user can claim an employee invite", async ({ page }) => {
  await loginAs(page, E2E.claimer)

  // Step 1: request the emailed verification code. Outside production the
  // endpoint returns the code as `devCode` so the test can complete the flow.
  const codeRes = await page.request.post("/api/me/claim-invite/request-code", {
    data: { token: E2E.inviteToken },
  })
  expect(codeRes.status()).toBe(200)
  const codeBody = await codeRes.json()
  const code = codeBody.data.devCode
  expect(code).toMatch(/^\d{6}$/)

  // Step 2: claim with the code.
  const res = await page.request.post("/api/me/claim-invite", {
    data: { token: E2E.inviteToken, code },
  })
  expect(res.status()).toBe(200)

  const body = await res.json()
  expect(body.data.organizationId).toBe(E2E.orgActive)
})
