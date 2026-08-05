/**
 * The sandbox staff preview never acts on the signed-in user's behalf.
 *
 * /my-shifts stands a seeded employee in for the manager when the org is a
 * demo, so a visitor can see the employee half of the product. But three of the
 * panels on that page — the cover pool, the shift-offer inbox, and the per-shift
 * "offer this for cover" button — post as *whoever is signed in*, and the
 * services behind them resolve the caller's own employee record. A demo manager
 * has none. All three answered 403 "You don't have an employee profile in this
 * workspace", on a page that was at that moment headed "My Shifts" and showing
 * a full week of them.
 *
 * The gate is a single boolean, `viewingSelf`, which must stay false while
 * previewing someone else. Source-level like tenantIsolation.test.ts: this is a
 * property of how the page is wired, and no type or runtime assertion catches
 * it — the panels render fine and fail only once they fetch.
 */

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const MY_SHIFTS = join(process.cwd(), "app/(manager)/my-shifts/page.tsx")
const src = readFileSync(MY_SHIFTS, "utf8")

/** The expression `viewingSelf` is assigned. */
function viewingSelfExpr(): string {
  const m = src.match(/const viewingSelf\s*=\s*([^\n]+)/)
    expect(m, "could not find the viewingSelf assignment in my-shifts").not.toBeNull()
  return m![1]
}

describe("sandbox staff preview", () => {
  it("does not treat a previewed employee as the signed-in user", () => {
    expect(
      viewingSelfExpr(),
      "viewingSelf must be false while previewing seeded staff, or the cover and offer panels post as a manager who has no employee record and 403",
    ).toContain("previewOf")
  })

  it("still distinguishes the picked employee from the viewer", () => {
    // Guards the test above from being satisfied by a hardcoded `false`, which
    // would also disable these panels for real employees.
    expect(viewingSelfExpr()).toContain("selectedId")
  })

  it.each([
    ["CoverPoolPanel", "the cover pool"],
    ["MyShiftOffersPanel", "the shift-offer inbox"],
    ["OfferCoverButton", "the per-shift cover button"],
  ])("%s is rendered only when viewing self", (component, label) => {
    // Every occurrence in JSX position must sit behind the gate. Matching the
    // opening tag keeps the import statement out of it.
    const uses = [...src.matchAll(new RegExp(`<${component}\\b`, "g"))]
    expect(uses.length, `${component} is no longer rendered by my-shifts`).toBeGreaterThan(0)

    for (const use of uses) {
      // Only the enclosing JSX expression counts — everything back to the `{`
      // that opens it. A wider window happily reads the *neighbouring* panel's
      // gate and passes while this one renders unconditionally.
      const openBrace = src.lastIndexOf("{", use.index!)
      expect(openBrace, `${component} is not inside a JSX expression`).toBeGreaterThan(-1)
      const gate = src.slice(openBrace + 1, use.index!)
      expect(
        gate,
        `${label} must be gated on viewingSelf in its own JSX expression — it posts as the signed-in user`,
      ).toContain("viewingSelf")
    }
  })

  it("names the previewed employee rather than calling the week 'mine'", () => {
    // The banner explains whose week this is; the heading must agree with it.
    expect(src).toContain("staffView.theirs")
    expect(src).toContain("demoPreview")
  })
})
