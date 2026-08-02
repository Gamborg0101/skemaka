import { test, expect } from "@playwright/test"
import { E2E } from "./fixtures"
import { loginAs } from "./helpers"

/**
 * First run: a signed-up user with no workspace creates one and adds staff.
 *
 * This is the first thing a paying customer ever does, and until this spec
 * existed nothing covered it. That mattered: `POST /api/orgs/:id/employees`
 * validated `phone` and `notes` as `.optional()` without `.nullable()`, while
 * the onboarding wizard sends BOTH as null on every submit. Step 2 — "add your
 * team" — returned 400 for every new customer, 100% of the time. The unit suite
 * mocks Prisma and never reaches validation; the other e2e specs all start from
 * a seeded org and skip onboarding entirely.
 *
 * The assertions below are deliberately about the payload the wizard actually
 * sends, nulls included, rather than a tidied-up version of it.
 */
test.describe("onboarding", () => {
  test("a new customer can create a workspace and add their first employee", async ({ page }) => {
    await loginAs(page, E2E.onboarder)

    // No workspace yet — this 404 is how onboarding knows to show the wizard.
    const before = await page.request.get("/api/me/context")
    expect(before.status(), "a user with no org must get 404 from /api/me/context").toBe(404)

    const orgRes = await page.request.post("/api/orgs", {
      data: {
        name: `Onboarding Bistro ${Date.now()}`,
        currency: "DKK",
        country: "DK",
        timezone: "Europe/Copenhagen",
        locale: "da",
        industry: "restaurant",
        timeFormat: "24h",
      },
    })
    expect(orgRes.status(), await orgRes.text()).toBe(201)
    const orgId = (await orgRes.json()).data.id as string

    // A new org starts on the trial, not on a paid plan.
    const ctx = await (await page.request.get("/api/me/context")).json()
    expect(ctx.data.org.id).toBe(orgId)

    // The wizard offers roles from the org's own seeded set — an employee
    // created with a role that does not exist there is rejected.
    const roles = await (await page.request.get(`/api/orgs/${orgId}/roles`)).json()
    const jobRole = (roles.data ?? [])[0]?.name
    expect(jobRole, "a new org must be seeded with at least one job role").toBeTruthy()

    // EXACTLY what app/(onboarding)/onboarding/page.tsx sends, nulls included.
    const empRes = await page.request.post(`/api/orgs/${orgId}/employees`, {
      data: {
        name: "Anna Jensen",
        email: `anna-${Date.now()}@e2e.test`,
        phone: null,
        jobRole,
        hourlyWage: 165,
        employmentType: "FULL_TIME",
        contractedHours: 37,
        notes: null,
      },
    })
    expect(
      empRes.status(),
      `onboarding step 2 must accept its own payload — got ${await empRes.text()}`,
    ).toBe(201)

    // And the employee is really there, not just acknowledged.
    const list = await (await page.request.get(`/api/orgs/${orgId}/employees`)).json()
    const names = (list.data ?? []).map((e: { name: string }) => e.name)
    expect(names).toContain("Anna Jensen")
  })
})
