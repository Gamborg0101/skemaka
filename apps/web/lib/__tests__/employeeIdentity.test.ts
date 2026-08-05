/**
 * An employee is identified by their linked account, not only by email.
 *
 * `claimInvite` sets `employee.userId` and deliberately does NOT rewrite
 * `employee.email` — so the two diverge the moment someone is invited at
 * anna@restaurant.dk and signs in with a personal Google account. Both
 * employee-facing pages used to look up by `session.user.email` alone, so a
 * fully claimed employee was told "No employee profile — ask your manager to
 * add you as an employee". Forever. They were an employee.
 *
 * `portal/layout.tsx` matched on `userId` while `portal/page.tsx` matched on
 * email, so such a person was recognised well enough to be forced through phone
 * verification and then told they didn't exist.
 *
 * Source-level, like tenantIsolation.test.ts: the bug lives in a Prisma filter
 * that types can't check, and the two files must not drift apart again.
 */

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const PORTAL_PAGE = join(process.cwd(), "app/(employee)/portal/page.tsx")
const PORTAL_LAYOUT = join(process.cwd(), "app/(employee)/portal/layout.tsx")
const PORTAL_ACCOUNT = join(process.cwd(), "app/(employee)/portal/account/page.tsx")
const PORTAL_AVAILABILITY = join(process.cwd(), "app/(employee)/portal/availability/page.tsx")
const MY_SHIFTS = join(process.cwd(), "app/(manager)/my-shifts/page.tsx")
const AVAILABILITY_SERVICE = join(process.cwd(), "lib/services/availabilityService.ts")
const COVER_SERVICE = join(process.cwd(), "lib/services/coverService.ts")
const OFFER_SERVICE = join(process.cwd(), "lib/services/shiftOfferService.ts")

/** The `where` of the first employee lookup in a file. */
function employeeWhere(path: string, anchor = "db.employee.findFirst("): string {
  const src = readFileSync(path, "utf8")
  const start = src.indexOf(anchor)
  expect(start, `could not find an employee lookup in ${path}`).toBeGreaterThan(-1)
  const where = src.indexOf("where:", start)
  // Stop at whichever comes first — these lookups end in different clauses.
  const ends = ["orderBy:", "select:", "include:"]
    .map((k) => src.indexOf(k, where))
    .filter((i) => i > -1)
  expect(ends.length, `could not find the end of the where clause in ${path}`).toBeGreaterThan(0)
  return src.slice(where, Math.min(...ends))
}

describe("employee identity resolution", () => {
  it("the portal page matches on the linked account, not email alone", () => {
    const where = employeeWhere(PORTAL_PAGE)
    expect(where, "portal/page.tsx must match on userId — an employee who signs in with a different email than they were invited at is otherwise locked out")
      .toContain("userId")
  })

  it("the portal page still accepts email, for employees who haven't claimed yet", () => {
    expect(employeeWhere(PORTAL_PAGE)).toContain("email")
  })

  it("my-shifts matches on the linked account too", () => {
    expect(employeeWhere(MY_SHIFTS), "my-shifts/page.tsx has the same email-only failure mode")
      .toContain("userId")
  })

  it("my-shifts keeps its organizationId scoping alongside the OR", () => {
    // Employee is unique on [organizationId, email], NOT email alone. Widening
    // the filter to an OR without keeping the org scope would let this page
    // render another restaurant's roster.
    expect(employeeWhere(MY_SHIFTS)).toContain("organizationId")
  })

  it("the portal layout and page agree on how an employee is identified", () => {
    // The layout gates phone verification; the page renders the shifts. When
    // they disagreed, a claimed employee was pushed through verification and
    // then told they had no profile.
    expect(employeeWhere(PORTAL_LAYOUT)).toContain("userId")
    expect(employeeWhere(PORTAL_PAGE)).toContain("userId")
  })

  it.each([
    ["the account page", PORTAL_ACCOUNT],
    ["the availability page", PORTAL_AVAILABILITY],
  ])("%s resolves the employee the same way", (_name, path) => {
    // Every tab in the portal shell must agree, or an employee gets a working
    // roster and a broken account page — or vice versa.
    const where = employeeWhere(path)
    expect(where, `${path} must match on userId`).toContain("userId")
    expect(where, `${path} must still accept email, for employees who haven't claimed`)
      .toContain("email")
  })

  it("the services behind the employee pages match on more than userId", () => {
    // The pages were fixed while the services they call were not: an employee
    // added by email who never clicked their invite has userId null, so their
    // shifts rendered fine while every cover, offer and availability call
    // answered "You don't have an employee profile in this workspace".
    for (const [label, path, anchor] of [
      ["getEmployeeIdForUser", AVAILABILITY_SERVICE, "export async function getEmployeeIdForUser"],
      // Anchored on the employee lookup itself: requireEmployee reads the
      // caller's email first, so the function declaration would match that
      // query's `where` instead.
      ["coverService.requireEmployee", COVER_SERVICE, "const emp = await db.employee.findFirst("],
      ["shiftOfferService.requireEmployee", OFFER_SERVICE, "const emp = await db.employee.findFirst("],
    ] as const) {
      const where = employeeWhere(path, anchor)
      expect(where, `${label} must accept an email match, not userId alone`).toContain("email")
      expect(where, `${label} must match on the linked account`).toContain("userId")
      // Employee is unique on [organizationId, email], not email alone. An OR
      // without the org scope resolves to another restaurant's staff member.
      expect(where, `${label} must stay scoped to one organization`).toContain("organizationId")
    }
  })
})
