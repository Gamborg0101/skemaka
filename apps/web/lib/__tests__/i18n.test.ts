import { describe, it, expect } from "vitest"
import { getMessages, pickShiftQuote, SUPPORTED_LOCALES, matchLocale, type Locale } from "@skemaka/i18n"
import { getMessageTranslator, resolveRecipientLocale } from "@/lib/messages"

// ── Catalog parity ────────────────────────────────────────────────────────────
// Every locale must mirror English's key set exactly, and every message must
// use the same ICU placeholders as its English source. This is the guard rail
// that makes adding a new locale (de/nb/sv) safe: a missing or drifted key
// fails CI instead of rendering a raw key (or crashing) in production.

type Tree = Record<string, unknown>

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out.set(path, value)
    else if (value && typeof value === "object") {
      for (const [k, v] of flatten(value as Tree, path)) out.set(k, v)
    }
  }
  return out
}

function placeholders(message: string): string[] {
  // Strip plural/select branch bodies ("one {employee}") so branch text isn't
  // mistaken for arguments, then capture ICU argument names: {name} / {n, plural…}.
  const withoutBranches = message.replace(/\b(?:zero|one|two|few|many|other|=\d+)\s*\{[^{}]*\}/g, "")
  return [...withoutBranches.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort()
}

describe("i18n catalog parity", () => {
  const en = flatten(getMessages("en") as unknown as Tree)

  for (const locale of SUPPORTED_LOCALES.filter((l) => l !== "en")) {
    const other = flatten(getMessages(locale) as unknown as Tree)

    it(`${locale} has exactly the same keys as en`, () => {
      const missing = [...en.keys()].filter((k) => !other.has(k))
      const extra = [...other.keys()].filter((k) => !en.has(k))
      expect(missing, `keys missing from ${locale}`).toEqual([])
      expect(extra, `keys in ${locale} that don't exist in en`).toEqual([])
    })

    it(`${locale} uses the same ICU placeholders as en`, () => {
      const drifted: string[] = []
      for (const [key, enMsg] of en) {
        const otherMsg = other.get(key)
        if (otherMsg === undefined) continue // covered by the key test
        if (placeholders(enMsg).join(",") !== placeholders(otherMsg).join(",")) {
          drifted.push(`${key}: en={${placeholders(enMsg)}} ${locale}={${placeholders(otherMsg)}}`)
        }
      }
      expect(drifted).toEqual([])
    })

    it(`${locale} has no empty messages`, () => {
      const empty = [...other.entries()].filter(([, v]) => v.trim() === "").map(([k]) => k)
      expect(empty).toEqual([])
    })
  }
})

// ── Shift-quote parity ────────────────────────────────────────────────────────
// Quote sets are translated 1:1 (same length per industry) so the same shiftId
// deterministically maps to the "same" line in every language. If a locale's
// set drifted in size, the hash would land on a different quote per language.

describe("shift quote locale parity", () => {
  const industries = [undefined, "restaurant", "cafe", "retail", "hospitality", "healthcare",
    "salon", "fitness", "warehouse", "cleaning", "childcare", "security"]

  it("every locale yields a non-empty quote for every industry", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const industry of industries) {
        expect(pickShiftQuote("shift-abc123", industry, locale).length).toBeGreaterThan(0)
      }
    }
  })

  it("locales stay index-aligned (same shiftId → same set position)", () => {
    // Two ids that map to different indices in en must also differ in da —
    // a cheap proxy for equal set lengths without exporting the raw arrays.
    for (const industry of industries) {
      const pairs = ["a", "b", "c", "d", "e", "f", "g"].map((id) =>
        SUPPORTED_LOCALES.map((l) => pickShiftQuote(id, industry, l)),
      )
      const enDistinct = new Set(pairs.map(([en]) => en)).size
      const daDistinct = new Set(pairs.map(([, da]) => da)).size
      expect(daDistinct).toBe(enDistinct)
    }
  })
})

// ── Recipient locale resolution ───────────────────────────────────────────────

describe("resolveRecipientLocale", () => {
  it("uses the employee locale when supported", () => {
    expect(resolveRecipientLocale("da", "en")).toBe("da")
    expect(resolveRecipientLocale("da-DK", "en")).toBe("da")
  })

  it("falls back to the org locale", () => {
    expect(resolveRecipientLocale(null, "da")).toBe("da")
    expect(resolveRecipientLocale(undefined, "da-DK")).toBe("da")
  })

  it("falls back to English for unsupported or missing languages", () => {
    expect(resolveRecipientLocale("de-DE", "sv-SE")).toBe("en")
    expect(resolveRecipientLocale(null, null)).toBe("en")
    expect(resolveRecipientLocale()).toBe("en")
  })

  it("skips an unsupported employee locale but honours a supported org locale", () => {
    expect(resolveRecipientLocale("de-DE", "da-DK")).toBe("da")
  })
})

describe("matchLocale", () => {
  it("matches base languages and full tags, case-insensitively", () => {
    expect(matchLocale("da")).toBe("da")
    expect(matchLocale("DA-dk")).toBe("da")
    expect(matchLocale("en-US")).toBe("en")
    expect(matchLocale("de")).toBeNull()
  })
})

// ── Template rendering smoke tests ────────────────────────────────────────────

describe("server message templates", () => {
  it("renders a Danish SMS with interpolated values", () => {
    const t = getMessageTranslator("da", "sms")
    const msg = t("shiftAssigned", { name: "Mette", orgName: "Café Hjørnet", when: "mandag, 09:00–15:00" })
    expect(msg).toBe("Hej Mette, du er sat på en vagt hos Café Hjørnet: mandag, 09:00–15:00.")
  })

  it("renders the Danish opt-out footer", () => {
    const t = getMessageTranslator("da", "sms")
    expect(t("optOut")).toBe("Svar STOP for at afmelde.")
  })

  it("renders Danish email markup with <strong> tags", () => {
    const t = getMessageTranslator("da", "emails")
    const html = t.markup("claimCode.intro", {
      orgName: "Café Hjørnet",
      strong: (chunks) => `<strong>${chunks}</strong>`,
    })
    expect(html).toContain("<strong>Café Hjørnet</strong>")
    expect(html).toContain("knytte din konto")
  })

  it("renders English by default for unsupported locales via the resolver", () => {
    const locale: Locale = resolveRecipientLocale("fr-FR")
    const t = getMessageTranslator(locale, "sms")
    expect(t("noShifts")).toBe("No shifts this week.")
  })
})
