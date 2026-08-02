import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

/**
 * Guards the client/server contract for optional free-text fields.
 *
 * The dialogs send `notes.trim() || null` for an empty box — an empty optional
 * field goes over the wire as `null`, not as an absent key. A Zod field declared
 * `.optional()` without `.nullable()` therefore REJECTS it, and the route 400s.
 *
 * That shipped: `POST /api/orgs/:orgId/employees` had `notes: z.string().optional()`
 * while its PATCH sibling had `.nullable().optional()`, so adding an employee
 * without a note failed with "notes: Expected string, received null" — the
 * primary onboarding action, broken for anyone who left the notes box empty.
 *
 * The unit suite could not catch it (it mocks Prisma, never the schema) and
 * neither could typecheck. This scans the schemas themselves.
 */

const API_ROOT = join(__dirname, "../../app/api")

/** Fields the UI sends as `null` when left blank. */
const NULLABLE_TEXT_FIELDS = /^\s*(notes?|phone):\s*z\.string\(\)/

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return routeFiles(full)
    return entry === "route.ts" ? [full] : []
  })
}

describe("request schemas", () => {
  const files = routeFiles(API_ROOT)

  it("finds route files to check", () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it("every optional notes/note/phone field also accepts null", () => {
    const offenders: string[] = []

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n")
      lines.forEach((line, i) => {
        if (!NULLABLE_TEXT_FIELDS.test(line)) return
        // Required fields are fine — the UI only sends null where it may omit.
        if (!line.includes(".optional()")) return
        if (line.includes(".nullable()")) return
        offenders.push(`${file.replace(API_ROOT, "app/api")}:${i + 1} — ${line.trim()}`)
      })
    }

    expect(
      offenders,
      "these fields are .optional() but not .nullable(), so a blank box (sent as null) is rejected:\n" +
        offenders.join("\n"),
    ).toEqual([])
  })
})
