/**
 * Locale registry — the single place to add a new language.
 *
 * Adding a locale: add it to SUPPORTED_LOCALES, LOCALE_LABELS and LOCALE_TAGS,
 * then create `messages/<locale>/` with the same JSON files as `messages/en/`.
 * The catalog-parity test in apps/web fails until every key is translated.
 */

export const SUPPORTED_LOCALES = ["en", "da"] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

/** Locale for visitors whose browser doesn't prefer a supported language. */
export const DEFAULT_LOCALE: Locale = "en"

/** Native-language display names, for language pickers. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  da: "Dansk",
}

/**
 * BCP 47 tags used for Intl date/number formatting. UI locale "en" keeps the
 * pre-i18n en-GB formatting (Monday-first weeks, 24h-friendly).
 */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-GB",
  da: "da-DK",
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * Map a BCP 47 language tag (e.g. from Accept-Language or navigator.language)
 * to a supported locale, or null when we don't support the language.
 */
export function matchLocale(languageTag: string): Locale | null {
  const base = languageTag.trim().toLowerCase().split("-")[0]
  return isLocale(base) ? base : null
}
