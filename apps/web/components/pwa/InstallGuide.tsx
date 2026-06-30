"use client"

import { useEffect, useState } from "react"
import {
  ChevronDown,
  MonitorDown,
  Share,
  MoreVertical,
  Plus,
  Download,
  Check,
  Globe,
  Copy,
} from "lucide-react"
import { useInstallPrompt } from "./useInstallPrompt"

type PlatformId = "computer" | "iphone" | "android"

type Platform = {
  id: PlatformId
  label: string
  icon: React.ReactNode
}

const PLATFORMS: Platform[] = [
  { id: "computer", label: "Computer", icon: <MonitorDown className="size-5" /> },
  { id: "iphone", label: "iPhone & iPad", icon: <Share className="size-5" /> },
  { id: "android", label: "Android", icon: <Plus className="size-5" /> },
]

/**
 * Step-by-step install guide with one expandable section per platform.
 * The section matching the visitor's device auto-opens on mount; on a desktop
 * Chromium browser that has fired `beforeinstallprompt`, the Computer section
 * also surfaces a live one-click Install button.
 */
export function InstallGuide() {
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt()
  const [open, setOpen] = useState<PlatformId | null>(null)
  const [justInstalled, setJustInstalled] = useState(false)

  // Auto-open the section that matches the visitor's device so they land on the
  // right steps without hunting. Falls back to "computer".
  useEffect(() => {
    const ua = navigator.userAgent
    const detected: PlatformId = /iphone|ipad|ipod/i.test(ua)
      ? "iphone"
      : /android/i.test(ua)
      ? "android"
      : "computer"
    setOpen(detected)
  }, [])

  const installed = isInstalled || justInstalled

  async function handleInstall() {
    const outcome = await promptInstall()
    if (outcome === "accepted") setJustInstalled(true)
  }

  return (
    <div className="space-y-3">
      <AppAddress />

      {installed && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          <Check className="size-4 shrink-0" />
          Skemaka is installed — open it from your home screen or desktop.
        </div>
      )}

      {PLATFORMS.map((p) => {
        const isOpen = open === p.id
        return (
          <div
            key={p.id}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : p.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                {p.icon}
              </span>
              <span className="flex-1 text-sm font-semibold text-gray-900">{p.label}</span>
              <ChevronDown
                className={`size-4 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 px-4 py-4">
                {p.id === "computer" && (
                  <ComputerSteps canInstall={canInstall} onInstall={handleInstall} />
                )}
                {p.id === "iphone" && <IphoneSteps />}
                {p.id === "android" && <AndroidSteps />}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Shows the address users should open to install — every platform's first step
 * is "open Skemaka in your browser", so this answers "open it where?". Uses the
 * live origin so it's correct in any environment, and offers click + copy so the
 * guide works even when it's being read on a different device than the install.
 */
function AppAddress() {
  const [origin, setOrigin] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  // Strip the protocol for display, keep the full URL for click + copy.
  const display = origin.replace(/^https?:\/\//, "")

  async function copy() {
    try {
      await navigator.clipboard.writeText(origin)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the link is still clickable */
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-medium text-gray-500">Open Skemaka at this address:</p>
      <div className="mt-2 flex items-center gap-2">
        <Globe className="size-4 shrink-0 text-gray-400" />
        <a
          href={origin || "/"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 truncate text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
        >
          {display || "…"}
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-green-600" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Copy
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function ComputerSteps({
  canInstall,
  onInstall,
}: {
  canInstall: boolean
  onInstall: () => void
}) {
  return (
    <div className="space-y-4">
      {canInstall && (
        <button
          onClick={onInstall}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Download className="size-4" />
          Install Skemaka now
        </button>
      )}
      <ol className="space-y-3 text-sm text-gray-600">
        <Step n={1}>Open Skemaka in <strong className="text-gray-900">Chrome</strong> or <strong className="text-gray-900">Edge</strong>.</Step>
        <Step n={2}>
          Click the install icon{" "}
          <MonitorDown className="inline size-4 align-text-bottom text-blue-600" />{" "}
          at the right end of the address bar. Don&rsquo;t see it? Open the{" "}
          <MoreVertical className="inline size-4 align-text-bottom text-gray-500" />{" "}
          menu (top-right) instead.
        </Step>
        <Step n={3}>Choose <strong className="text-gray-900">Install</strong> (or <strong className="text-gray-900">Install Skemaka</strong>).</Step>
        <Step n={4}>Confirm — Skemaka opens in its own window and is added to your desktop / taskbar.</Step>
      </ol>
      <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
        On <strong className="text-gray-700">Safari (Mac)</strong>: open the{" "}
        <strong className="text-gray-700">File</strong> menu and choose{" "}
        <strong className="text-gray-700">Add to Dock</strong>.
      </p>
    </div>
  )
}

function IphoneSteps() {
  return (
    <ol className="space-y-3 text-sm text-gray-600">
      <Step n={1}>Open Skemaka in <strong className="text-gray-900">Safari</strong> (it has to be Safari).</Step>
      <Step n={2}>
        Tap the Share icon{" "}
        <Share className="inline size-4 align-text-bottom text-blue-600" /> in the toolbar.
      </Step>
      <Step n={3}>Scroll down and tap <strong className="text-gray-900">Add to Home Screen</strong>.</Step>
      <Step n={4}>Tap <strong className="text-gray-900">Add</strong> — the Skemaka icon appears on your home screen.</Step>
    </ol>
  )
}

function AndroidSteps() {
  return (
    <ol className="space-y-3 text-sm text-gray-600">
      <Step n={1}>Open Skemaka in <strong className="text-gray-900">Chrome</strong>.</Step>
      <Step n={2}>
        Tap the{" "}
        <MoreVertical className="inline size-4 align-text-bottom text-gray-500" /> menu (top-right).
      </Step>
      <Step n={3}>Tap <strong className="text-gray-900">Add to Home screen</strong> (or <strong className="text-gray-900">Install app</strong>).</Step>
      <Step n={4}>Tap <strong className="text-gray-900">Install</strong> to confirm.</Step>
    </ol>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-500">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  )
}
