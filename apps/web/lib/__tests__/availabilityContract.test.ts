/**
 * The availability form and its API agree on field names.
 *
 * These two files are joined by untyped JSON, so TypeScript cannot see a
 * mismatch between them. It didn't: the form posted `preferredStart`/
 * `preferredEnd`, the route's zod schema declared `startTime`/`endTime`, and
 * zod silently strips keys it doesn't recognise. Every employee's preferred
 * hours were persisted as null, the employee saw "All done!", and the manager's
 * booking dialog quietly fell back to a 09:00–17:00 default. Nothing failed
 * loudly enough for anyone to notice.
 *
 * Same approach as tenantIsolation.test.ts: assert on the source, and fail
 * loudly if the anchors move so a restructure gets re-checked by a human.
 */

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const FORM = join(process.cwd(), "app/(employee)/availability/[token]/page.tsx")
const ROUTE = join(process.cwd(), "app/api/availability/[token]/route.ts")

/** The object literal the form actually POSTs. */
function postedDayShape(): string {
  const src = readFileSync(FORM, "utf8")
  const start = src.indexOf("const days = availability.map(")
  expect(start, "could not find the POST body mapping in the availability form").toBeGreaterThan(-1)
  const end = src.indexOf("}))", start)
  expect(end, "could not find the end of the POST body mapping").toBeGreaterThan(start)
  return src.slice(start, end)
}

/** Field names the route's zod schema accepts. */
function schemaFields(): string[] {
  const src = readFileSync(ROUTE, "utf8")
  const start = src.indexOf("const DaySchema")
  const end = src.indexOf(".superRefine", start)
  expect(start, "could not find DaySchema in the availability route").toBeGreaterThan(-1)
  expect(end, "could not find the end of DaySchema").toBeGreaterThan(start)
  return [...src.slice(start, end).matchAll(/^\s{4}(\w+):\s+z\./gm)].map((m) => m[1])
}

describe("availability form ↔ API contract", () => {
  it("the route still declares the fields we think it does", () => {
    // Guards the test itself: if the schema is rewritten, this fails rather
    // than the assertions below passing vacuously.
    expect(schemaFields().sort()).toEqual(["date", "endTime", "isAvailable", "startTime"])
  })

  it("the form posts every field the schema declares", () => {
    const posted = postedDayShape()
    for (const field of schemaFields()) {
      expect(posted, `the availability form never sends "${field}" — zod will strip it and the value is lost`)
        .toContain(`${field}:`)
    }
  })

  it("does not post the raw component state", () => {
    const src = readFileSync(FORM, "utf8")
    // `JSON.stringify({ days: availability })` was the original bug: it shipped
    // the UI's own field names straight to an API that names them differently.
    expect(src, "the form must map its state to the API's field names, not post state directly")
      .not.toContain("JSON.stringify({ days: availability })")
  })

  it("does not send the UI's internal field names over the wire", () => {
    const posted = postedDayShape()
    for (const uiOnly of ["preferredStart:", "preferredEnd:"]) {
      // Fine as the *source* of a value (`d.preferredStart`), never as a key.
      expect(posted, `"${uiOnly}" is a UI-only name; the API will not read it`).not.toContain(uiOnly)
    }
  })
})
