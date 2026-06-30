"use client"

import { useCallback, useEffect, useState } from "react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

// Module-level state so the `beforeinstallprompt` event (which fires once,
// shortly after load) is captured even before the InstallPrompt component
// mounts — e.g. while the user is still on onboarding step 1.
let deferred: BeforeInstallPromptEvent | null = null
let installed = false
let initialized = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

/** Wire up the global install listeners once. Safe to call repeatedly. */
export function initPwaInstall() {
  if (initialized || typeof window === "undefined") return
  initialized = true
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener("appinstalled", () => {
    deferred = null
    installed = true
    emit()
  })
}

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    initPwaInstall()
    const sync = () => {
      setCanInstall(!!deferred)
      setIsInstalled(installed)
    }
    sync()
    listeners.add(sync)
    return () => {
      listeners.delete(sync)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferred) return null
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === "accepted") installed = true
    deferred = null
    emit()
    return outcome
  }, [])

  return { canInstall, isInstalled, promptInstall }
}
