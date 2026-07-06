import { describe, it, expect, afterEach } from "vitest"
import { isSuperadmin, actingOrgIdFrom } from "@/lib/platform"

const ORIGINAL = process.env.SUPERADMIN_EMAIL

afterEach(() => {
  process.env.SUPERADMIN_EMAIL = ORIGINAL
})

describe("isSuperadmin", () => {
  it("matches the configured email case-insensitively", () => {
    process.env.SUPERADMIN_EMAIL = "boss@example.com"
    expect(isSuperadmin("boss@example.com")).toBe(true)
    expect(isSuperadmin("BOSS@example.com")).toBe(true)
    expect(isSuperadmin("  boss@example.com  ")).toBe(true)
  })

  it("rejects a different email", () => {
    process.env.SUPERADMIN_EMAIL = "boss@example.com"
    expect(isSuperadmin("someone@else.com")).toBe(false)
  })

  it("grants nobody when SUPERADMIN_EMAIL is unset or blank", () => {
    delete process.env.SUPERADMIN_EMAIL
    expect(isSuperadmin("boss@example.com")).toBe(false)
    process.env.SUPERADMIN_EMAIL = "   "
    expect(isSuperadmin("boss@example.com")).toBe(false)
  })

  it("rejects null/undefined/empty email", () => {
    process.env.SUPERADMIN_EMAIL = "boss@example.com"
    expect(isSuperadmin(null)).toBe(false)
    expect(isSuperadmin(undefined)).toBe(false)
    expect(isSuperadmin("")).toBe(false)
  })
})

describe("actingOrgIdFrom", () => {
  it("returns the org id only for the super admin", () => {
    process.env.SUPERADMIN_EMAIL = "boss@example.com"
    expect(actingOrgIdFrom("boss@example.com", "org-123")).toBe("org-123")
  })

  it("ignores the cookie for a non-super-admin (forged cookie is inert)", () => {
    process.env.SUPERADMIN_EMAIL = "boss@example.com"
    expect(actingOrgIdFrom("attacker@evil.com", "org-123")).toBeNull()
  })

  it("returns null when no cookie is set", () => {
    process.env.SUPERADMIN_EMAIL = "boss@example.com"
    expect(actingOrgIdFrom("boss@example.com", undefined)).toBeNull()
    expect(actingOrgIdFrom("boss@example.com", "")).toBeNull()
  })
})
