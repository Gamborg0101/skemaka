import "server-only"
import { createTranslator } from "next-intl"
import { DEFAULT_LOCALE, getMessages, LOCALE_TAGS, matchLocale, type Locale } from "@skemaka/i18n"

/**
 * Resolve the language for a server-generated message (email/SMS/push) from
 * whatever locale hints are available, in priority order — typically
 * `resolveRecipientLocale(employee.locale, org.locale)`. Values may be bare
 * ("da") or full BCP 47 tags ("da-DK", as onboarding stores from
 * navigator.language); unsupported languages fall through to English.
 */
export function resolveRecipientLocale(
  ...candidates: Array<string | null | undefined>
): Locale {
  for (const candidate of candidates) {
    if (!candidate) continue
    const matched = matchLocale(candidate)
    if (matched) return matched
  }
  return DEFAULT_LOCALE
}

/** BCP 47 tag for date formatting in messages to this recipient. */
export function recipientLocaleTag(locale: Locale): string {
  return LOCALE_TAGS[locale]
}

/** Translator for server-rendered message templates (no React context). */
export function getMessageTranslator<NS extends "emails" | "sms">(locale: Locale, namespace: NS) {
  return createTranslator({ locale, messages: getMessages(locale), namespace })
}
