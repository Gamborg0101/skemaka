import { describe, it, expect } from "vitest"
import { getMessages, SUPPORTED_LOCALES } from "@skemaka/i18n"
import {
  resolveServiceErrorMessageKey,
  translateServiceError,
  type Translate,
} from "@/lib/serviceErrorMessages"

// A minimal stand-in for next-intl's `useTranslations("common")`, resolving
// dotted keys against the real catalog and doing the same `{placeholder}`
// substitution next-intl would. Exercising the real en/da JSON (not a
// hand-rolled fixture) is what makes the "known key renders" case meaningful:
// it fails if the catalog key is ever renamed or removed.
function makeTranslate(locale: "en" | "da"): Translate {
  const messages = getMessages(locale) as unknown as { common: Record<string, unknown> }
  return (key, values) => {
    const parts = key.split(".")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = messages.common
    for (const part of parts) node = node?.[part]
    if (typeof node !== "string") throw new Error(`missing message for key "${key}"`)
    return node.replace(/\{(\w+)\}/g, (_, name: string) =>
      values && name in values ? String(values[name]) : `{${name}}`,
    )
  }
}

describe("resolveServiceErrorMessageKey", () => {
  it("resolves a known messageKey to its common.serviceErrors dotted key", () => {
    expect(resolveServiceErrorMessageKey({ messageKey: "shiftConflict" })).toBe(
      "serviceErrors.shiftConflict",
    )
  })

  it("returns undefined for an unrecognised messageKey", () => {
    expect(resolveServiceErrorMessageKey({ messageKey: "somethingBrandNew" })).toBeUndefined()
  })

  it("returns undefined when messageKey is missing", () => {
    expect(resolveServiceErrorMessageKey({ error: "Not found" })).toBeUndefined()
    expect(resolveServiceErrorMessageKey(undefined)).toBeUndefined()
    expect(resolveServiceErrorMessageKey(null)).toBeUndefined()
  })
})

describe("translateServiceError", () => {
  for (const locale of SUPPORTED_LOCALES) {
    const translate = makeTranslate(locale)

    it(`renders the ${locale} translation for a known key`, () => {
      const message = translateServiceError(
        translate,
        { error: "This employee already has a shift on this date", code: "CONFLICT", messageKey: "shiftConflict" },
        "fallback",
      )
      // The English server message must NOT win when the key is known — this
      // is the assertion that would fail if the mapping were ever removed or
      // broken, proving the test isn't vacuous.
      const expected = translate("serviceErrors.shiftConflict")
      expect(message).toBe(expected)
      expect(message).not.toBe("This employee already has a shift on this date")
    })

    it(`interpolates ICU params in the ${locale} translation (seatLimit)`, () => {
      const message = translateServiceError(
        translate,
        {
          error: "Your plan covers 5 employees and they are all active. Increase your plan to add another.",
          code: "SEAT_LIMIT",
          messageKey: "seatLimit",
          messageParams: { seats: 5 },
        },
        "fallback",
      )
      expect(message).toContain("5")
      expect(message).not.toContain("{seats}")
    })
  }

  it("falls back to the server's English message for an unrecognised messageKey", () => {
    const translate = makeTranslate("da")
    const message = translateServiceError(
      translate,
      { error: "Some brand new failure the client doesn't know about", code: "CONFLICT", messageKey: "somethingBrandNew" },
      "generic fallback",
    )
    expect(message).toBe("Some brand new failure the client doesn't know about")
  })

  it("falls back to the server's English message when messageKey is absent entirely", () => {
    const translate = makeTranslate("da")
    const message = translateServiceError(translate, { error: "Too many requests" }, "generic fallback")
    expect(message).toBe("Too many requests")
  })

  it("falls back to the generic fallback when there is no server message either", () => {
    const translate = makeTranslate("da")
    expect(translateServiceError(translate, undefined, "generic fallback")).toBe("generic fallback")
    expect(translateServiceError(translate, {}, "generic fallback")).toBe("generic fallback")
  })
})
