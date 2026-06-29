// Marketing screenshot pipeline.
//
// Single source of truth: every product shot is rendered from the public /demo
// route (which renders lib/demo/demoData.ts) or the landing page. Because the
// landing page's feature images are captured FROM the same /demo DOM, marketing
// can never drift from the real UI — change the demo data or the components and
// the next `pnpm screenshots` run updates the marketing assets to match.
//
// Usage:
//   pnpm screenshots                 # boots `next dev`, captures, shuts down
//   BASE_URL=http://localhost:3000 pnpm screenshots   # reuse a running server
//   pnpm screenshots:check           # CI: regenerate + fail if anything changed
//
// One-time setup:  pnpm install && npx playwright install chromium

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
  // Feature tiles — element shots straight from the demo DOM (no drift).
  { name: "feature-rota", path: "/demo", viewport: DESKTOP, selector: "[data-shot='rota']" },
  { name: "feature-conflict", path: "/demo", viewport: DESKTOP, selector: "[data-shot='conflict']" },
]

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

async function main() {
  let server
  if (SPAWN) {
    console.log(`▶ booting next dev on :${PORT}`)
    server = spawn("pnpm", ["exec", "next", "dev", "-p", PORT], {
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

    await browser.close()
  } finally {
    if (server) server.kill("SIGTERM")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
