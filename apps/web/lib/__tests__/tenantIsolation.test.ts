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

describe("tenant isolation: server-rendered manager pages", () => {
  // Pages under app/(manager)/ have no requireOrgMember choke point — they query
  // Prisma directly, so the structural guard above does not cover them.
  //
  // /my-shifts is the load-bearing case: one findFirst resolves WHICH org the
  // entire page renders (employee picker, coworkers, cover requests all derive
  // from it). Employee is unique on [organizationId, email], NOT on email alone,
  // so a person employed at two restaurants has two rows. Without an org filter
  // Postgres returns an indeterminate one and the page shows another org's data.
  const MY_SHIFTS = join(process.cwd(), "app/(manager)/my-shifts/page.tsx")

  function selfEmployeeLookup(): string {
    const src = readFileSync(MY_SHIFTS, "utf8")
    const start = src.indexOf("const selfEmployee = await db.employee.findFirst(")
    // Anchor moved when the demo stand-in fallback was added below this lookup;
    // the isolation property was re-verified by hand at that point, and the
    // fallback now has its own coverage in the demo test below.
    const end = src.indexOf("let previewOf")
    // If either anchor moves, fail loudly rather than asserting on an empty
    // string — a restructure of this page needs re-verifying by hand.
    expect(start, "could not locate the selfEmployee lookup in my-shifts/page.tsx").toBeGreaterThan(-1)
    expect(end, "could not locate the selfEmployee guard in my-shifts/page.tsx").toBeGreaterThan(start)
    return src.slice(start, end)
  }

  // `select:` also names organizationId, so matching the whole call would pass
  // even on the unscoped version. Narrow to the filter itself.
  function selfEmployeeWhereClause(): string {
    const block = selfEmployeeLookup()
    const where = block.indexOf("where:")
    const select = block.indexOf("select:")
    expect(where, "no where clause in the selfEmployee lookup").toBeGreaterThan(-1)
    expect(select, "no select clause in the selfEmployee lookup").toBeGreaterThan(where)
    return block.slice(where, select)
  }

  it("my-shifts scopes the self-employee lookup to a single organization", () => {
    expect(
      selfEmployeeWhereClause(),
      "the selfEmployee findFirst must FILTER on organizationId, or /my-shifts can render another restaurant's shifts",
    ).toContain("organizationId")
  })

  // The demo stand-in is a SECOND path that decides which org's data the page
  // renders — if it ever resolved an employee without an org filter, a sandbox
  // visitor would be shown a real restaurant's roster.
  it("my-shifts scopes the demo stand-in lookup to a single organization", () => {
    const src = readFileSync(MY_SHIFTS, "utf8")
    const start = src.indexOf("let previewOf")
    const end = src.indexOf("if (!viewer)")
    expect(start, "could not locate the demo stand-in block in my-shifts/page.tsx").toBeGreaterThan(-1)
    expect(end, "could not locate the end of the demo stand-in block").toBeGreaterThan(start)
    const block = src.slice(start, end)

    // Gated on a resolved orgId at all.
    expect(block, "the demo stand-in must only run once an orgId is known").toContain("orgId")
    // Every query inside it filters by that org.
    const queries = block.split("db.").slice(1)
    expect(queries.length, "expected the stand-in block to query the database").toBeGreaterThan(0)
    for (const q of queries) {
      const scoped = q.includes("organizationId: orgId") || q.includes("where: { id: orgId }")
      expect(scoped, `an unscoped query in the demo stand-in block: db.${q.slice(0, 60)}`).toBe(true)
    }
    // And it only ever fires for a sandbox.
    expect(block, "the demo stand-in must be gated on isDemo").toContain("isDemo")
  })

  it("my-shifts orders the self-employee lookup deterministically", () => {
    expect(
      selfEmployeeLookup(),
      "findFirst without orderBy returns an indeterminate row on Neon/Postgres when more than one matches",
    ).toContain("orderBy")
  })
})
