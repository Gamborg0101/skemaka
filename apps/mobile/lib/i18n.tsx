import { createContext, useContext, useMemo, type ReactNode } from "react"
import { getLocales } from "expo-localization"
import { setLocaleTag } from "@/lib/localeTag"
import {
  getMessages,
  matchLocale,
  DEFAULT_LOCALE,
  LOCALE_TAGS,
  type Locale,
  type Messages,
} from "@skemaka/i18n"

/**
 * Translation for the mobile app, over the same `@skemaka/i18n` catalogs the web
 * app uses. The catalog-parity test in apps/web covers every namespace it finds,
 * so `mobile` is guarded there too: a Danish key that drifts from English fails
 * CI rather than rendering a raw key on someone's phone.
 *
 * next-intl is a Next.js library and cannot run here, so this is a deliberately
 * small replacement: namespace lookup plus `{placeholder}` interpolation. It is
 * not a full ICU implementation — there is no plural/select support, because no
 * mobile string needs one today. If one does, reach for a real ICU formatter
 * rather than growing this.
 */

type Namespace = keyof Messages

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

/**
 * The device's preferred language, if we support it.
 *
 * Read once at module scope: `getLocales()` hits native, and the OS language
 * cannot change without restarting the app anyway.
 */
export function deviceLocale(): Locale {
  for (const { languageTag } of getLocales()) {
    const matched = matchLocale(languageTag)
    if (matched) return matched
  }
  return DEFAULT_LOCALE
}

export function I18nProvider({
  children,
  locale,
}: {
  children: ReactNode
  /** Overrides the device language — e.g. once the org's locale is known. */
  locale?: Locale
}) {
  const resolved = locale ?? deviceLocale()

  // Keep the date/time singleton in step. lib/dates.ts and lib/utils.ts are
  // plain functions called from outside React, so they read the tag from a
  // module singleton rather than this context. Set during render, before any
  // child formats a date — an effect would run too late and the first paint
  // would show English dates under Danish headings.
  setLocaleTag(resolved)

  return <LocaleContext.Provider value={resolved}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  return useContext(LocaleContext)
}

/** BCP-47 tag for the active locale — for toLocaleDateString and friends. */
export function useLocaleTag(): string {
  return LOCALE_TAGS[useLocale()]
}

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  )
}

/**
 * Translate keys within one namespace.
 *
 * Falls back to English for a key missing from the active locale, and to the key
 * itself if it is missing everywhere — a visible but harmless artefact, rather
 * than a crash or a blank screen in someone's hand mid-shift.
 */
export function useTranslations(namespace: Namespace) {
  const locale = useLocale()

  return useMemo(() => {
    const active = getMessages(locale)[namespace] as Record<string, unknown>
    const fallback = getMessages(DEFAULT_LOCALE)[namespace] as Record<string, unknown>

    return (key: string, values?: Record<string, string | number>): string => {
      const resolve = (tree: Record<string, unknown>): string | undefined => {
        const found = key
          .split(".")
          .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], tree)
        return typeof found === "string" ? found : undefined
      }

      const template = resolve(active) ?? resolve(fallback)
      if (template === undefined) {
        if (__DEV__) console.warn(`[i18n] missing key "${namespace}.${key}"`)
        return key
      }
      return interpolate(template, values)
    }
  }, [locale, namespace])
}
