"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Check, Share, Download, ExternalLink } from "lucide-react"
import { useInstallPrompt } from "./useInstallPrompt"

/**
 * Platform-aware "install this app" card.
 * - Chrome/Android/desktop with a captured prompt → a native "Install app" button.
 * - iPhone/iPad (Safari has no programmatic install) → Add-to-Home-Screen steps.
 * - Already installed (standalone) → a confirmation.
 * - Anything else → generic instructions.
 */
export function InstallPrompt() {
  const t = useTranslations("onboarding.install")
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt()
  const [isIOS, setIsIOS] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [justInstalled, setJustInstalled] = useState(false)

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean }
    const sa =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
    setStandalone(sa)
    // iPadOS 13+ reports itself as "Macintosh", so a plain /ipad/ test misses
    // every modern iPad — those users were shown the generic "install manually"
    // copy instead of the Share-sheet steps that actually work on Safari. The
    // touch-points check is the standard way to tell an iPad from a Mac, since
    // desktop Safari reports maxTouchPoints 0.
    const iPadOS = nav.platform === "MacIntel" && nav.maxTouchPoints > 1
    setIsIOS(/iphone|ipad|ipod/i.test(nav.userAgent) || iPadOS)
  }, [])

  const installed = standalone || isInstalled || justInstalled

  async function handleInstall() {
    const outcome = await promptInstall()
    if (outcome === "accepted") setJustInstalled(true)
  }

  return (
    <div className="rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="size-12 rounded-xl shadow-sm" />
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{t("cardTitle")}</h3>
          <p className="text-xs text-gray-500">{t("cardSub")}</p>
        </div>
      </div>

      <div className="mt-4">
        {installed ? (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-700">
            <Check className="size-4 shrink-0" />
            {t("installed")}
          </div>
        ) : canInstall ? (
          <button
            onClick={handleInstall}
            className="flex w-full items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="size-4" />
            {t("installBtn")}
          </button>
        ) : isIOS ? (
          <ol className="space-y-2.5 text-sm text-gray-600">
            <li className="flex items-start gap-2.5">
              <Step n={1} />
              <span>
                {t.rich("ios1", {
                  icon: () => (
                    <Share className="inline size-4 align-text-bottom text-blue-600" />
                  ),
                  b: (chunks) => <strong className="text-gray-900">{chunks}</strong>,
                })}
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Step n={2} />
              <span>
                {t.rich("ios2", {
                  b: (chunks) => <strong className="text-gray-900">{chunks}</strong>,
                })}
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Step n={3} />
              <span>
                {t.rich("ios3", {
                  b: (chunks) => <strong className="text-gray-900">{chunks}</strong>,
                })}
              </span>
            </li>
          </ol>
        ) : (
          <p className="text-sm text-gray-600">
            {t("generic")}
          </p>
        )}

        {!installed && (
          <Link
            href="/install"
            target="_blank"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            {t("seeSteps")}
            <ExternalLink className="size-3.5" />
          </Link>
        )}
      </div>
    </div>
  )
}

function Step({ n }: { n: number }) {
  return (
    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-500">
      {n}
    </span>
  )
}
