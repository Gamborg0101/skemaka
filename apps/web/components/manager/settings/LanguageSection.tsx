"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Languages } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useOrg } from "@/lib/orgContext"
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@skemaka/i18n"
import { setLocaleCookie } from "@/components/marketing/LocaleToggle"
import { SettingsSection } from "./SettingsSection"

/**
 * Org-level language. Persisted on the organization (drives the language of
 * emails/SMS/push to staff) and mirrored into the NEXT_LOCALE cookie so the
 * manager's own UI switches immediately.
 */
export function LanguageSection() {
  const t = useTranslations("manager.settings")
  const { orgId } = useOrg()
  const router = useRouter()
  const active = useLocale() as Locale
  const [saving, setSaving] = useState(false)

  async function handleSetLocale(locale: Locale) {
    if (locale === active || saving) return
    setSaving(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      })
      if (!r.ok) {
        const data = (await r.json()) as { error?: string }
        throw new Error(data.error ?? t("langError"))
      }
      setLocaleCookie(locale)
      toast.success(t("langSaved"))
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("langError"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection icon={Languages} title={t("langTitle")} description={t("langDesc")}>
      <div className="mt-4 flex flex-wrap gap-2">
        {SUPPORTED_LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            onClick={() => handleSetLocale(locale)}
            disabled={saving}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
              active === locale
                ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:text-gray-200"
            )}
          >
            <span className="font-mono text-xs uppercase opacity-70">{locale}</span>
            {LOCALE_LABELS[locale]}
          </button>
        ))}
      </div>
    </SettingsSection>
  )
}
