"use client"

import Link from "next/link"
import { Zap, AlertTriangle, XCircle } from "lucide-react"
import { useTranslations } from "next-intl"
import type { BillingBlockCode } from "@/lib/billing"

/**
 * Full-screen block shown when an org has lost access to paid features.
 *
 * It replaces the manager shell entirely, on purpose. Before this existed the
 * API returned 402 and the client swallowed it, so `/schedule` rendered
 * "No employees yet — add your first employee": a customer whose trial ended
 * was told, in effect, that their roster had been deleted, and was offered no
 * way to pay. The reassurance that the data is still there is not decoration —
 * it is the first question anyone in this state asks.
 */
export function BillingPaywall({ code }: { code: BillingBlockCode }) {
  const t = useTranslations("manager.paywall")

  // Message keys are spelled out per variant rather than built from `code`:
  // next-intl types `t()` against the catalog, so a template-literal key is not
  // assignable and a typo would otherwise only surface at runtime.
  const variant = {
    TRIAL_EXPIRED: {
      title: t("trialExpired.title"),
      body: t("trialExpired.body"),
      Icon: Zap,
      accent: "text-blue-600 dark:text-blue-400",
      halo: "bg-blue-50 dark:bg-blue-950/40",
    },
    PAST_DUE_EXPIRED: {
      title: t("pastDueExpired.title"),
      body: t("pastDueExpired.body"),
      Icon: AlertTriangle,
      accent: "text-amber-600 dark:text-amber-400",
      halo: "bg-amber-50 dark:bg-amber-950/40",
    },
    SUBSCRIPTION_CANCELED: {
      title: t("canceled.title"),
      body: t("canceled.body"),
      Icon: XCircle,
      accent: "text-red-600 dark:text-red-400",
      halo: "bg-red-50 dark:bg-red-950/40",
    },
  }[code]

  const { Icon } = variant

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 px-6">
      <div className="w-full max-w-md text-center">
        <div
          className={`mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl ${variant.halo}`}
        >
          <Icon className={`size-6 ${variant.accent}`} />
        </div>

        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {variant.title}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {variant.body}
        </p>

        <Link
          href="/billing"
          className="mt-8 inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {t("cta")}
        </Link>
      </div>
    </div>
  )
}
