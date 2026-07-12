"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Bell, X } from "lucide-react"
import { usePushSubscription } from "./usePushSubscription"

const DISMISS_KEY = "skemaka.pushPromptDismissed"

/**
 * Small dismissible prompt asking the employee to turn on push notifications,
 * shown until they either enable them or dismiss the card. Renders nothing
 * when push is unsupported, blocked, or already subscribed — enabling push is
 * one tap and the card gets out of the way permanently.
 */
export function EnableNotificationsCard() {
  const t = useTranslations("portal.push")
  const { status, subscribe } = usePushSubscription()
  const [dismissed, setDismissed] = useState(true) // assume dismissed until localStorage read
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1")
  }, [])

  if (status !== "default" || dismissed) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1")
    setDismissed(true)
  }

  const enable = async () => {
    setBusy(true)
    await subscribe()
    setBusy(false)
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-4 py-3">
      <Bell className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t("title")}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("body")}
        </p>
      </div>
      <button
        onClick={enable}
        disabled={busy}
        className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {busy ? t("enabling") : t("enable")}
      </button>
      <button
        onClick={dismiss}
        aria-label={t("dismiss")}
        className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
