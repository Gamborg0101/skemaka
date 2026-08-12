// Marketing screenshot pipeline.
//
// Single source of truth: every shot here is rendered from the public /demo
// route (which renders lib/demo/demoData.ts) or the landing page, so these
// assets can't drift from the real UI — change the demo data or the components
// and the next `npm run screenshots` run updates them to match.
//
// NOTE: the landing page's feature tiles (public/marketing/screens/shot-*.png)
// are NOT produced here — they are committed images referenced directly by
// app/page.tsx. This script only writes to OUT_DIR below.
//
// Usage:
//   npm run screenshots              # boots `next dev`, captures, shuts down
//   BASE_URL=http://localhost:3000 npm run screenshots   # reuse a running server
//   npm run screenshots:check        # CI: regenerate + fail if anything changed
//
// One-time setup:  npm install && npx playwright install chromium

import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import { chromium } from "playwright"

const OUT_DIR = "screenshots"
const PORT = process.env.SHOT_PORT ?? "3210"
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`
const SPAWN = !process.env.BASE_URL

// Retina scale factors keep the assets crisp on high-DPI displays.
const DESKTOP = { width: 1280, height: 832, deviceScaleFactor: 2 }
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }

/**
 * The manifest IS the contract between the app and the marketing site.
 * - `viewport`  controls device emulation
 * - `fullPage`  captures the whole scroll height
 * - `selector`  captures a single element (used for landing feature tiles)
 */
const SHOTS = [
  { name: "landing-desktop-hero", path: "/", viewport: DESKTOP },
  { name: "landing-mobile-hero", path: "/", viewport: MOBILE },
  { name: "demo-desktop", path: "/demo", viewport: DESKTOP, fullPage: true },
  { name: "demo-mobile", path: "/demo", viewport: MOBILE, fullPage: true },
  { name: "00-login", path: "/login", viewport: DESKTOP },
]

/**
 * Reference shots of the manager app, used by CLAUDE.md so an agent can see the
 * UI before changing it.
 *
 * These need an authenticated manager, so the run clicks through /demo once and
 * reuses that session. That means one throwaway demo org per run — `isDemo`, so
 * the cleanup cron deletes it after 48h and it never reaches platform metrics.
 *
 * Previously hand-captured, which is why they went stale: CLAUDE.md asks for a
 * retake after every UI change, and nobody re-runs a manual process.
 *
 * - `click` presses a button by accessible name after load (view toggles).
 */
const MANAGER_SHOTS = [
  { name: "01-schedule", path: "/schedule" },
  { name: "02-employees", path: "/employees" },
  { name: "03-availability", path: "/availability" },
  { name: "04-costs", path: "/costs" },
  { name: "05-time-off", path: "/time-off" },
  { name: "06-settings", path: "/settings" },
  { name: "07-schedule-timeline", path: "/schedule", click: "Timeline" },
  { name: "08-my-shifts", path: "/my-shifts" },
]

/**
 * Chrome that is true of the capture environment but not of the product.
 *
 * `nextjs-portal` is the Next.js dev-tools button. It renders in the
 * bottom-left corner whenever these run against a dev server — which is the
 * default — and lands directly on top of the sidebar's org name. That produced
 * a long-standing "sidebar org name is truncated / the avatar overlaps it" bug
 * report against a UI that was never broken: the screenshots were.
 */
const HIDE_CAPTURE_CHROME = `
  nextjs-portal,
  [data-nextjs-dev-tools-button],
  [data-demo-banner],
  [class*="cookie"] { display: none !important; }
`

async function waitForServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    await sleep(1000)
  }
  throw new Error(`Server at ${url} did not become ready in ${timeoutMs}ms`)
}

/**
 * Sign into a throwaway demo restaurant and capture the manager pages.
 * One context for all of them, so the session is established once.
 */
async function captureManagerShots(browser) {
  const context = await browser.newContext({
    viewport: { width: DESKTOP.width, height: DESKTOP.height },
    deviceScaleFactor: DESKTOP.deviceScaleFactor,
    // Reference shots are English; without this the run inherits whatever
    // Accept-Language the machine sends and the images flip language.
    locale: "en-GB",
  })
  // Pre-consent so the banner never covers a shot. Shape must match
  // lib/cookieConsent.ts — a malformed value just makes the banner reappear.
  const consent = encodeURIComponent(JSON.stringify({
    version: 1,
    necessary: true,
    preferences: true,
    analytics: false,
    decidedAt: new Date().toISOString(),
  }))
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: BASE_URL },
    { name: "skemaka_cookie_consent", value: consent, url: BASE_URL },
  ])

  // Mark the demo tour as seen before the first paint. It is a first-visit
  // coach-mark, and every run signs into a brand-new sandbox, so without this it
  // opens over the schedule header and hides the very thing the reference shot
  // exists to show — the week grid and the Week/Timeline toggle. Key must match
  // STORAGE_KEY in components/manager/DemoTour.tsx.
  await context.addInitScript(() => {
    try {
      localStorage.setItem("skemaka.demoTourSeen", "1")
    } catch {
      /* storage blocked — the tour reappears, which the shot will show */
    }
  })

  const page = await context.newPage()
  await page.goto(BASE_URL + "/demo", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: /try the live demo/i }).click()
  await page.waitForURL("**/schedule", { timeout: 60_000 })
  await page.waitForLoadState("networkidle")

  for (const shot of MANAGER_SHOTS) {
    await page.goto(BASE_URL + shot.path, { waitUntil: "networkidle" })
    if (shot.click) {
      await page.getByRole("button", { name: shot.click, exact: true }).click()
      await sleep(500)
    }
    await page.addStyleTag({ content: HIDE_CAPTURE_CHROME })
    await sleep(400)

    const file = `${OUT_DIR}/${shot.name}.png`
    await page.screenshot({ path: file })
    console.log(`✔ ${file}`)
  }

  await context.close()
}

async function main() {
  let server
  if (SPAWN) {
    console.log(`▶ booting next dev on :${PORT}`)
    server = spawn("npx", ["next", "dev", "-p", PORT], {
      stdio: "ignore",
      env: process.env,
    })
  }

  try {
    await waitForServer(BASE_URL + "/")
    const browser = await chromium.launch()

    for (const shot of SHOTS) {
      const { name, path, viewport, fullPage, selector } = shot
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.deviceScaleFactor ?? 2,
        isMobile: viewport.isMobile ?? false,
        hasTouch: viewport.hasTouch ?? false,
      })
      const page = await context.newPage()
      await page.goto(BASE_URL + path, { waitUntil: "networkidle" })
      // Let fonts/images settle so shots are deterministic across runs.
      await page.waitForLoadState("load")
      await page.addStyleTag({ content: HIDE_CAPTURE_CHROME })
      await sleep(300)

      const file = `${OUT_DIR}/${name}.png`
      if (selector) {
        await page.locator(selector).screenshot({ path: file })
      } else {
        await page.screenshot({ path: file, fullPage: Boolean(fullPage) })
      }
      console.log(`✔ ${file}`)
      await context.close()
    }

    await captureManagerShots(browser)

    await browser.close()
  } finally {
    if (server) server.kill("SIGTERM")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
