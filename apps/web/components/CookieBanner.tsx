"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Cookie } from "lucide-react"
import {
  readConsent,
  writeConsent,
  CONSENT_OPEN_SETTINGS_EVENT,
} from "@/lib/cookieConsent"

/**
 * EU/Danish cookie consent — self-hosted, no third-party CMP script.
 *
 * Shows once per visitor (and again when CONSENT_VERSION bumps or the yearly
 * consent expires). "Accept all" / "Only necessary" are equally prominent, as
 * the guidance requires; a settings view offers per-category toggles.
 * Necessary cookies are always on. The banner can be re-opened at any time via
 * the "Cookie settings" footer links (CONSENT_OPEN_SETTINGS_EVENT).
 */
export function CookieBanner() {
  const t = useTranslations("common.cookies")
  const [visible, setVisible] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState(true)
  const [analytics, setAnalytics] = useState(false)

  useEffect(() => {
    // Client-only read (document.cookie): decide visibility after mount.
    const existing = readConsent()
    if (!existing) setVisible(true)

    const openSettings = () => {
      const current = readConsent()
      setPreferences(current?.preferences ?? true)
      setAnalytics(current?.analytics ?? false)
      setShowSettings(true)
      setVisible(true)
    }
    window.addEventListener(CONSENT_OPEN_SETTINGS_EVENT, openSettings)
    return () => window.removeEventListener(CONSENT_OPEN_SETTINGS_EVENT, openSettings)
  }, [])

  if (!visible) return null

  const decide = (choice: { preferences: boolean; analytics: boolean }) => {
    writeConsent(choice)
    setVisible(false)
    setShowSettings(false)
  }

  const toggle = (
    checked: boolean,
    onChange: (() => void) | null,
    label: string,
    desc: string,
  ) => (
    <label className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${onChange ? "cursor-pointer border-gray-200 dark:border-gray-700" : "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={!onChange}
        onChange={onChange ?? undefined}
        className="mt-0.5 size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">{desc}</span>
      </span>
    </label>
  )

  return (
    <div
      role="dialog"
      aria-label={t("settingsTitle")}
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
    >
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
        {showSettings ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("settingsTitle")}</p>
            <div className="grid gap-2">
              {toggle(true, null, t("necessaryLabel"), t("necessaryDesc"))}
              {toggle(preferences, () => setPreferences((v) => !v), t("preferencesLabel"), t("preferencesDesc"))}
              {toggle(analytics, () => setAnalytics((v) => !v), t("analyticsLabel"), t("analyticsDesc"))}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => decide({ preferences, analytics })}
                className="rounded-lg bg-slate-900 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
              >
                {t("save")}
              </button>
              <button
                type="button"
                onClick={() => decide({ preferences: true, analytics: true })}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {t("acceptAll")}
              </button>
              <Link href="/cookies" className="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline">
                {t("bannerLinkLabel")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-300 sm:flex-1">
              <Cookie className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <span>
                {t("banner")}{" "}
                <Link href="/cookies" className="underline text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                  {t("bannerLinkLabel")}
                </Link>
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {/* Equal prominence for accept/decline, per the consent guidance. */}
              <button
                type="button"
                onClick={() => decide({ preferences: true, analytics: true })}
                className="rounded-lg bg-slate-900 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
              >
                {t("acceptAll")}
              </button>
              <button
                type="button"
                onClick={() => decide({ preferences: false, analytics: false })}
                className="rounded-lg bg-slate-900 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
              >
                {t("onlyNecessary")}
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {t("customize")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Footer link that re-opens the consent banner in settings mode. */
export function CookieSettingsLink({ className }: { className?: string }) {
  const t = useTranslations("common.cookies")
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_SETTINGS_EVENT))}
      className={className ?? "hover:text-gray-600 transition-colors"}
    >
      {t("footerLink")}
    </button>
  )
}
