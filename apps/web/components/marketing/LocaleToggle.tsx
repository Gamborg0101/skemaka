"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useLocale } from "next-intl"
import { isLocale, SUPPORTED_LOCALES, type Locale } from "@skemaka/i18n"

/**
 * Persist an explicit language choice. Server rendering reads this cookie
 * first (see lib/locale.ts), so a refresh re-renders the tree in the new
 * language without any URL change.
 */
export function setLocaleCookie(locale: Locale) {
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; samesite=lax`
}

/**
 * DA/EN switch for public pages. `variant` only affects colours so it works
 * on both the dark hero nav and light footers.
 */
export function LocaleToggle({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const locale = useLocale()
  const router = useRouter()

  const active = variant === "dark" ? "text-white" : "text-gray-900"
  const inactive =
    variant === "dark"
      ? "text-white/40 hover:text-white/70"
      : "text-gray-400 hover:text-gray-600"

  return (
    <div className="flex items-center gap-1 text-sm font-medium" role="group" aria-label="Language">
      {SUPPORTED_LOCALES.map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span className={variant === "dark" ? "text-white/20" : "text-gray-200"}>/</span>}
          <button
            type="button"
            aria-pressed={l === locale}
            className={`uppercase transition-colors ${l === locale ? active : inactive}`}
            onClick={() => {
              if (l === locale) return
              setLocaleCookie(l)
              router.refresh()
            }}
          >
            {l}
          </button>
        </span>
      ))}
    </div>
  )
}

function LangQuerySyncInner() {
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const lang = searchParams.get("lang")

  // Lets campaign links force a language (e.g. skemaka.com/?lang=da from
  // Danish ads) without URL-prefix routing: persist the choice, then
  // re-render server-side in that language.
  useEffect(() => {
    if (isLocale(lang) && lang !== locale) {
      setLocaleCookie(lang)
      router.refresh()
    }
  }, [lang, locale, router])

  return null
}

/** Mount once on public pages that should honour `?lang=`. */
export function LangQuerySync() {
  return (
    <Suspense fallback={null}>
      <LangQuerySyncInner />
    </Suspense>
  )
}
