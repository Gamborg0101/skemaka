import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  CONSENT_COOKIE,
  CONSENT_VERSION,
  readConsent,
  writeConsent,
  hasConsent,
} from "@/lib/cookieConsent"

// Minimal browser stubs (no jsdom dependency): a cookie jar with the append/
// expire semantics document.cookie actually has, and a no-op event target.
let jar: Record<string, string> = {}
vi.stubGlobal("document", {
  get cookie() {
    return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ")
  },
  set cookie(str: string) {
    const [pair, ...attrs] = str.split("; ")
    const eq = pair.indexOf("=")
    const key = pair.slice(0, eq)
    const value = pair.slice(eq + 1)
    const maxAge = attrs.find((a) => a.toLowerCase().startsWith("max-age="))
    if (maxAge && Number(maxAge.slice(8)) <= 0) delete jar[key]
    else jar[key] = value
  },
})
vi.stubGlobal("window", { dispatchEvent: vi.fn() })

beforeEach(() => {
  jar = {}
})

describe("cookieConsent", () => {
  it("has no consent before a choice is made", () => {
    expect(readConsent()).toBeNull()
    expect(hasConsent("preferences")).toBe(false)
    expect(hasConsent("analytics")).toBe(false)
    // Necessary never requires consent.
    expect(hasConsent("necessary")).toBe(true)
  })

  it("round-trips a choice through the cookie", () => {
    writeConsent({ preferences: true, analytics: false })
    const consent = readConsent()
    expect(consent).toMatchObject({
      version: CONSENT_VERSION,
      necessary: true,
      preferences: true,
      analytics: false,
    })
    expect(hasConsent("preferences")).toBe(true)
    expect(hasConsent("analytics")).toBe(false)
  })

  it("treats a stale consent version as no consent (banner re-appears)", () => {
    jar[CONSENT_COOKIE] = encodeURIComponent(JSON.stringify({
      version: CONSENT_VERSION - 1, necessary: true, preferences: true, analytics: true,
      decidedAt: new Date().toISOString(),
    }))
    expect(readConsent()).toBeNull()
    expect(hasConsent("analytics")).toBe(false)
  })

  it("survives a corrupted cookie", () => {
    jar[CONSENT_COOKIE] = "not-json"
    expect(readConsent()).toBeNull()
    expect(hasConsent("preferences")).toBe(false)
  })
})
