/**
 * The availability form and its APIs agree on field names.
 *
 * These files are joined by untyped JSON, so TypeScript cannot see a mismatch
 * between them. It didn't: the form posted `preferredStart`/`preferredEnd`, the
 * route's zod schema declared `startTime`/`endTime`, and zod silently strips
 * keys it doesn't recognise. Every employee's preferred hours were persisted as
 * null, the employee saw "All done!", and the manager's booking dialog quietly
 * fell back to a 09:00–17:00 default. Nothing failed loudly enough to notice.
 *
 * There are now two ways to reach the form — the tokenised link a manager mails
 * out, and the signed-in route at /portal/availability — posting to two
 * different endpoints whose schemas are duplicated. One form, two schemas: the
 * drift hazard moved rather than disappeared, so both are checked here.
 *
 * Same approach as tenantIsolation.test.ts: assert on the source, and fail
 * loudly if the anchors move so a restructure gets re-checked by a human.
 */

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const FORM = join(process.cwd(), "components/employee/AvailabilityDaysForm.tsx")
const TOKEN_PAGE = join(process.cwd(), "app/(employee)/availability/[token]/page.tsx")
const PORTAL_PAGE = join(process.cwd(), "app/(employee)/portal/availability/page.tsx")
const TOKEN_ROUTE = join(process.cwd(), "app/api/availability/[token]/route.ts")
const SUBMIT_ROUTE = join(
  process.cwd(),
  "app/api/orgs/[orgId]/availability/[requestId]/submit/route.ts",
)

/** The object literal the form actually POSTs. */
function postedDayShape(): string {
  const src = readFileSync(FORM, "utf8")
  const start = src.indexOf("const toPayload")
  expect(start, "could not find the POST body mapping in AvailabilityDaysForm").toBeGreaterThan(-1)
  const end = src.indexOf("}))", start)
  expect(end, "could not find the end of the POST body mapping").toBeGreaterThan(start)
  return src.slice(start, end)
}

/** Field names a route's zod schema accepts. */
function schemaFields(path: string): string[] {
  const src = readFileSync(path, "utf8")
  const start = src.indexOf("const DaySchema")
  const end = src.indexOf(".superRefine", start)
  expect(start, `could not find DaySchema in ${path}`).toBeGreaterThan(-1)
  expect(end, `could not find the end of DaySchema in ${path}`).toBeGreaterThan(start)
  return [...src.slice(start, end).matchAll(/^\s{4}(\w+):\s+z\./gm)].map((m) => m[1])
}

const ROUTES = [
  ["token link", TOKEN_ROUTE],
  ["signed-in submit", SUBMIT_ROUTE],
] as const

describe("availability form ↔ API contract", () => {
  it.each(ROUTES)("the %s route still declares the fields we think it does", (_name, path) => {
    // Guards the test itself: if a schema is rewritten, this fails rather than
    // the assertions below passing vacuously.
    expect(schemaFields(path).sort()).toEqual(["date", "endTime", "isAvailable", "startTime"])
  })

  it("both routes accept exactly the same fields", () => {
    // The schemas are copy-pasted. One form posts to both, so if they ever
    // diverge, whichever surface the employee used decides what gets saved.
    expect(schemaFields(TOKEN_ROUTE).sort()).toEqual(schemaFields(SUBMIT_ROUTE).sort())
  })

  it.each(ROUTES)("the form posts every field the %s schema declares", (_name, path) => {
    const posted = postedDayShape()
    for (const field of schemaFields(path)) {
      expect(
        posted,
        `the availability form never sends "${field}" — zod will strip it and the value is lost`,
      ).toContain(`${field}:`)
    }
  })

  it("does not post the raw component state", () => {
    const src = readFileSync(FORM, "utf8")
    // The form's own state uses "" for a blank time; the API wants null. Posting
    // state directly would send empty strings, which the schema rejects for an
    // available day — loudly, but only at submit time.
    expect(
      src,
      "the form must map its state through toPayload, not post state directly",
    ).not.toMatch(/JSON\.stringify\(\{\s*days:\s*days\s*\}\)/)
  })

  it("does not send the UI's internal field names over the wire", () => {
    const posted = postedDayShape()
    for (const uiOnly of ["preferredStart:", "preferredEnd:"]) {
      expect(posted, `"${uiOnly}" is a UI-only name; the API will not read it`).not.toContain(uiOnly)
    }
  })

  it.each([
    ["the tokenised link page", TOKEN_PAGE],
    ["the signed-in portal page", PORTAL_PAGE],
  ])("%s renders the shared form rather than its own", (_name, path) => {
    const src = readFileSync(path, "utf8")
    // Two hand-rolled copies of this form is how the field names drifted the
    // first time. Whichever surface an employee uses must run the same mapping.
    expect(src, `${path} must not hand-roll a second availability form`).not.toContain(
      "preferredStart",
    )
    expect(src).toMatch(/AvailabilityDaysForm|AvailabilityRequestList/)
  })
})
