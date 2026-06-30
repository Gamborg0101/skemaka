"use client"

import { useEffect } from "react"
import { initPwaInstall } from "./useInstallPrompt"

/**
 * Registers the minimal service worker so the app is installable as a PWA on
 * Android/Chrome (iOS "Add to Home Screen" works without one), and starts
 * listening for the install prompt. Renders nothing.
 *
 * The SW registers in dev too (the worker is a no-op pass-through that never
 * caches) so the install flow is testable on localhost, which browsers treat
 * as a secure context.
 */
export function RegisterSW() {
  useEffect(() => {
    initPwaInstall()

    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures are non-fatal — the app still works in-browser.
      })
    }
    if (document.readyState === "complete") register()
    else {
      window.addEventListener("load", register)
      return () => window.removeEventListener("load", register)
    }
  }, [])

  return null
}
