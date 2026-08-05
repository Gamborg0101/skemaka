"use client"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { MessageSquare, X } from "lucide-react"

/**
 * Asks an employee to verify their phone, without blocking them.
 *
 * The portal used to hard-redirect unverified employees to /verify-phone, a
 * page with no skip and no way back — so a failed SMS meant never seeing your
 * own shifts again. This is the replacement: the roster is readable either way,
 * and verification is framed as what it actually buys (getting texted when
 * shifts change) rather than as a toll gate.
 *
 * Dismissal is per-session on purpose. It should stop nagging someone who is
 * mid-task, and still be there next time — an unverified number means they are
 * silently missing shift notifications, which they should keep being told.
 */
export function PhoneVerifyBanner() {
  const t = useTranslations("portal")
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="mx-4 mt-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
      <div className="flex items-start gap-3">
        <MessageSquare className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            {t("phoneBannerTitle")}
          </p>
          <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-200/90">
            {t("phoneBannerBody")}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Link
              href="/verify-phone"
              className="inline-flex h-9 items-center rounded-lg bg-amber-600 px-3 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              {t("phoneBannerCta")}
            </Link>
            <button
              onClick={() => setDismissed(true)}
              className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            >
              {t("phoneBannerDismiss")}
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label={t("phoneBannerDismiss")}
          className="shrink-0 text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
