"use client"

import { useEffect } from "react"

/**
 * Guards authenticated pages against the browser's back/forward cache (bfcache).
 *
 * When a user logs out and presses the browser Back button, the browser can
 * restore the previous (authenticated) page straight from memory without making
 * a network request — so the middleware auth check never runs and the stale
 * logged-in view reappears. We listen for `pageshow` with `persisted === true`
 * (the signal that the page came from bfcache) and re-verify the session. If the
 * session cookie is gone, we send the user to /login instead of showing stale
 * content. When still logged in, nothing happens — no reload, no flicker.
 */
export function BfcacheGuard() {
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      fetch("/api/auth/session", { cache: "no-store" })
        .then((r) => r.json())
        .then((s) => {
          if (!s?.user) window.location.href = "/login"
        })
        .catch(() => {
          // Network/parse failure on restore — reload so middleware re-runs.
          window.location.reload()
        })
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [])

  return null
}
