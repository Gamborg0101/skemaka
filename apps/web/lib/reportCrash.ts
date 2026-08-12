"use client"

/**
 * Send a client-side crash to the team.
 *
 * The error boundaries used to call `logError`, which on the client writes to the
 * browser console and nowhere else — while the page told the user "The team has
 * been notified". Nobody was notified, and a white-screen is exactly the failure
 * a customer does not report themselves: they close the tab.
 *
 * `/api/bug-report` already persists to the BugReport table, emails the
 * superadmin, and shows up on /platform/errors, so this is wiring, not new
 * infrastructure. It accepts unauthenticated reports, which matters here — the
 * crash may be in the session itself.
 *
 * Fire-and-forget by design: an error page must render whatever happens to this
 * request, so failures are swallowed (after a console line, which is all we have
 * left at that point).
 */

const MAX_STACK = 10_000

/**
 * Digests already sent in this page's lifetime. A boundary that re-renders in a
 * loop would otherwise send one email per render; the superadmin gets one per
 * distinct crash instead.
 */
const reported = new Set<string>()

export function reportCrash(
  error: Error & { digest?: string },
  component: string,
): void {
  if (typeof window === "undefined") return

  // Prefer Next's digest (stable for the same server error), else the message.
  const key = error.digest ?? error.message
  if (reported.has(key)) return
  reported.add(key)

  const body = JSON.stringify({
    errorMessage: error.message || "Unknown client error",
    errorStack: error.stack?.slice(0, MAX_STACK) ?? null,
    url: window.location.href,
    component,
  })

  try {
    void fetch("/api/bug-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // The user is likely to reload or navigate away from a broken page; without
      // keepalive the browser cancels the request as the document goes away.
      keepalive: true,
    }).catch(() => {
      // Offline, blocked, or rate-limited. Nothing useful left to do.
    })
  } catch {
    // fetch itself unavailable — never let reporting break the error page.
  }
}
