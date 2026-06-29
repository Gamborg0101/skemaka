import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright E2E config for the money-path / access-control suite.
 *
 * Auth uses the env-gated "e2e" credentials provider (see lib/auth.ts), so the
 * dev server must run with E2E_TEST_LOGIN=1 and a shared E2E_TEST_PASSWORD. The
 * suite expects the deterministic dataset created by `pnpm seed:e2e`.
 *
 * Set E2E_BASE_URL to run against an already-running server (skips webServer).
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          E2E_TEST_LOGIN: "1",
          E2E_TEST_PASSWORD: process.env.E2E_TEST_PASSWORD ?? "e2e-secret",
        },
      },
})
