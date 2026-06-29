/**
 * Unit tests for the SMS opt-out keyword classification and phone normalization
 * that gate carrier/legal STOP compliance in lib/sms.ts.
 */
import { describe, it, expect } from "vitest"
import { classifyKeyword, normalizePhone } from "@/lib/sms"

describe("classifyKeyword", () => {
  it("recognizes STOP keywords regardless of case/whitespace", () => {
    for (const w of ["STOP", "stop", " Stop ", "unsubscribe", "CANCEL", "quit", "end", "stopall"]) {
      expect(classifyKeyword(w)).toBe("stop")
    }
  })

  it("recognizes START keywords", () => {
    for (const w of ["START", "yes", "unstop"]) {
      expect(classifyKeyword(w)).toBe("start")
    }
  })

  it("recognizes HELP keywords", () => {
    expect(classifyKeyword("HELP")).toBe("help")
    expect(classifyKeyword("info")).toBe("help")
  })

  it("returns null for anything else", () => {
    expect(classifyKeyword("hello there")).toBeNull()
    expect(classifyKeyword("")).toBeNull()
  })
})

describe("normalizePhone", () => {
  it("keeps a leading + and strips formatting", () => {
    expect(normalizePhone("+45 12 34 56 78")).toBe("+4512345678")
    expect(normalizePhone("+1 (555) 123-4567")).toBe("+15551234567")
  })

  it("strips formatting on numbers without a +", () => {
    expect(normalizePhone("(555) 123 4567")).toBe("5551234567")
  })

  it("matches across formats so a STOP suppresses stored variants", () => {
    expect(normalizePhone("+4512345678")).toBe(normalizePhone("+45 12-34-56-78"))
  })
})
