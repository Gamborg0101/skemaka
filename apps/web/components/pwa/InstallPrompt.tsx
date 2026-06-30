"use client"

import { useEffect, useState } from "react"
import { Check, Share, Download } from "lucide-react"
import { useInstallPrompt } from "./useInstallPrompt"

/**
 * Platform-aware "install this app" card.
 * - Chrome/Android/desktop with a captured prompt → a native "Install app" button.
 * - iPhone/iPad (Safari has no programmatic install) → Add-to-Home-Screen steps.
 * - Already installed (standalone) → a confirmation.
 * - Anything else → generic instructions.
 */
export function InstallPrompt() {
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt()
  const [isIOS, setIsIOS] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [justInstalled, setJustInstalled] = useState(false)

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean }
    const sa =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
    setStandalone(sa)
    setIsIOS(/iphone|ipad|ipod/i.test(nav.userAgent))
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
          <h3 className="text-sm font-semibold text-gray-900">Add Skemaka to your device</h3>
          <p className="text-xs text-gray-500">One-tap access from your home screen or desktop.</p>
        </div>
      </div>

      <div className="mt-4">
        {installed ? (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-700">
            <Check className="size-4 shrink-0" />
            Installed — open Skemaka from your home screen.
          </div>
        ) : canInstall ? (
          <button
            onClick={handleInstall}
            className="flex w-full items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="size-4" />
            Install Skemaka
          </button>
        ) : isIOS ? (
          <ol className="space-y-2.5 text-sm text-gray-600">
            <li className="flex items-start gap-2.5">
              <Step n={1} />
              <span>
                Tap the{" "}
                <Share className="inline size-4 align-text-bottom text-blue-600" />{" "}
                <strong className="text-gray-900">Share</strong> icon in Safari.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Step n={2} />
              <span>
                Choose <strong className="text-gray-900">Add to Home Screen</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Step n={3} />
              <span>
                Tap <strong className="text-gray-900">Add</strong> — done.
              </span>
            </li>
          </ol>
        ) : (
          <div className="space-y-3 text-sm text-gray-600">
            <p>Open <strong className="text-gray-900">skemaka.com</strong> in your browser, then:</p>
            <ul className="space-y-2">
              <li className="flex gap-2">
                <strong className="w-20 shrink-0 text-gray-900">iPhone</strong>
                <span>Tap Share, then Add to Home Screen.</span>
              </li>
              <li className="flex gap-2">
                <strong className="w-20 shrink-0 text-gray-900">Android</strong>
                <span>Tap the ⋮ menu, then Add to Home screen.</span>
              </li>
              <li className="flex gap-2">
                <strong className="w-20 shrink-0 text-gray-900">Computer</strong>
                <span>Click the install icon in the address bar.</span>
              </li>
            </ul>
          </div>
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
