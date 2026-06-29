/**
 * Unit tests for the structured logger's PII scrubbing — the guarantee the rest
 * of the app relies on when passing request context into logs.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { scrubPii, logError } from "@/lib/log"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("scrubPii", () => {
  it("redacts known PII keys case-insensitively", () => {
    const out = scrubPii({ email: "a@b.com", Phone: "123", wage: 42, name: "Ada" }) as Record<string, unknown>
    expect(out.email).toBe("[redacted]")
    expect(out.Phone).toBe("[redacted]")
    expect(out.wage).toBe("[redacted]")
    expect(out.name).toBe("Ada")
  })

  it("walks nested objects and arrays", () => {
    const out = scrubPii({
      user: { hourlyWage: 30, token: "x" },
      list: [{ email: "c@d.com" }, { ok: 1 }],
    }) as Record<string, unknown>
    const user = out.user as Record<string, unknown>
    expect(user.hourlyWage).toBe("[redacted]")
    expect(user.token).toBe("[redacted]")
    const list = out.list as Array<Record<string, unknown>>
    expect(list[0].email).toBe("[redacted]")
    expect(list[1].ok).toBe(1)
  })

  it("handles circular references without throwing", () => {
    const a: Record<string, unknown> = { name: "x" }
    a.self = a
    expect(() => scrubPii(a)).not.toThrow()
  })

  it("passes primitives through untouched", () => {
    expect(scrubPii(5)).toBe(5)
    expect(scrubPii("hello")).toBe("hello")
    expect(scrubPii(null)).toBe(null)
  })
})

describe("logError", () => {
  it("emits a single JSON line with scrubbed context and no PII", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    logError("test/scope", new Error("boom"), { requestId: "req-1", email: "secret@x.com" })

    expect(spy).toHaveBeenCalledTimes(1)
    const line = spy.mock.calls[0][0] as string
    const parsed = JSON.parse(line)
    expect(parsed.level).toBe("error")
    expect(parsed.scope).toBe("test/scope")
    expect(parsed.message).toBe("boom")
    expect(parsed.requestId).toBe("req-1")
    expect(parsed.email).toBe("[redacted]")
    expect(line).not.toContain("secret@x.com")
  })
})
