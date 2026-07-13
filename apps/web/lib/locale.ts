import "server-only"
import { cookies, headers } from "next/headers"
import { DEFAULT_LOCALE, isLocale, matchLocale, type Locale } from "@skemaka/i18n"

/**
 * Cookie holding the visitor's explicit language choice (set by the landing
 * toggle, the org language setting, or a `?lang=` link handled in proxy.ts).
 */
export const LOCALE_COOKIE = "NEXT_LOCALE"

/**
 * Resolve the UI locale for the current request:
 *   1. NEXT_LOCALE cookie — explicit choice always wins
 *   2. Accept-Language — Danish browsers get Danish
 *   3. DEFAULT_LOCALE (English)
 *
 * Deliberately no DB read: org preference is synced into the cookie
 * client-side (OrgProvider / settings) so `auth()` stays a pure JWT decode.
 */
export async function resolveLocale(): Promise<Locale> {
  const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value
  if (isLocale(cookieValue)) return cookieValue

  const acceptLanguage = (await headers()).get("accept-language")
  if (acceptLanguage) {
    // Entries are ordered by the browser; first supported language wins.
    for (const entry of acceptLanguage.split(",")) {
      const tag = entry.split(";")[0]
      if (!tag) continue
      const matched = matchLocale(tag)
      if (matched) return matched
    }
  }

  return DEFAULT_LOCALE
}
