import { type Page, expect } from "@playwright/test"

/**
 * Sign in through the env-gated "e2e" credentials provider (lib/auth.ts) by
 * driving NextAuth's CSRF + callback endpoints directly. Cookies land on the
 * page's context, so subsequent `page.goto` / `page.request` calls are
 * authenticated. Requires the server to run with E2E_TEST_LOGIN=1.
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  const password = process.env.E2E_TEST_PASSWORD ?? "e2e-secret"

  const csrfRes = await page.request.get("/api/auth/csrf")
  expect(csrfRes.ok()).toBeTruthy()
  const { csrfToken } = await csrfRes.json()

  const res = await page.request.post("/api/auth/callback/e2e", {
    form: { csrfToken, email, password, callbackUrl: "/", json: "true" },
  })
  // NextAuth responds 200 (json) or a redirect; either means the cookie was set.
  expect(res.status()).toBeLessThan(400)

  const session = await page.request.get("/api/auth/session")
  const body = await session.json()
  expect(body?.user?.email, `expected an authenticated session for ${email}`).toBe(email)
}
