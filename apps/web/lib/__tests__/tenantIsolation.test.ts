/**
 * Structural tenant-isolation guard.
 *
 * Every API route under /api/orgs/[orgId]/ operates on one restaurant's data,
 * so it MUST authorize the caller for that org via requireOrgMember — the single
 * choke point that enforces "a restaurant only touches its own data" in our
 * shared (pooled) multi-tenant database. This test fails if a new route under
 * [orgId] is added without that guard, turning an easy-to-miss data-leak bug
 * into a red build.
 */
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const ORG_ROUTES_ROOT = join(process.cwd(), "app/api/orgs/[orgId]")

function routeFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...routeFiles(full))
    else if (entry === "route.ts") out.push(full)
  }
  return out
}

describe("tenant isolation: /api/orgs/[orgId]/** routes", () => {
  const files = routeFiles(ORG_ROUTES_ROOT)

  it("discovers the org-scoped route handlers", () => {
    // Sanity check that the glob actually matched something, so a broken path
    // can't make the assertions below vacuously pass.
    expect(files.length).toBeGreaterThan(10)
  })

  for (const file of files) {
    const rel = file.slice(file.indexOf("app/api/"))
    it(`${rel} authorizes via requireOrgMember`, () => {
      const src = readFileSync(file, "utf8")
      expect(
        src.includes("requireOrgMember"),
        `${rel} is under [orgId] but never calls requireOrgMember — it may expose one restaurant's data to another.`,
      ).toBe(true)
    })
  }
})
