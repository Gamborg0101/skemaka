/**
 * Next.js instrumentation file — runs once on server startup (Node.js runtime).
 * In production, asserts that all required env vars are present and throws a
 * single clear error listing every missing one so the deploy fails fast rather
 * than surfacing confusing runtime errors later.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */

export async function register() {
  // Only validate in production — dev/test may intentionally omit some vars.
  if (process.env.NODE_ENV !== "production") return

  const REQUIRED_ENV_VARS = [
    "DATABASE_URL",
    "AUTH_SECRET",
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "NEXTAUTH_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ID",
    "RESEND_API_KEY",
    "NEXT_PUBLIC_APP_URL",
    "SUPERADMIN_EMAIL",
    "CRON_SECRET",
  ] as const

  const missing: string[] = REQUIRED_ENV_VARS.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === "",
  )

  // Upstash Redis (rate limiting) may be supplied under our canonical names or
  // under the KV_REST_API_* names that Vercel's native Upstash/KV integration
  // injects. Require one complete pair — see lib/upstash.ts for the same logic.
  const hasRedisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim()
  const hasRedisToken =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim()
  if (!hasRedisUrl) missing.push("UPSTASH_REDIS_REST_URL (or KV_REST_API_URL)")
  if (!hasRedisToken) missing.push("UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_TOKEN)")

  if (missing.length > 0) {
    throw new Error(
      `[startup] Missing required environment variables:\n${missing.map((k) => `  • ${k}`).join("\n")}\n\nSet these in your deployment environment before starting the server.`,
    )
  }

  // Variables that must NEVER exist in production:
  //
  // - E2E_TEST_LOGIN / E2E_TEST_PASSWORD — the test-login provider (lib/auth.ts)
  //   is full account-takeover-by-email gated only by a shared password.
  // - TWILIO_TO_OVERRIDE — a dev convenience that redirects EVERY outbound SMS to
  //   one number. In production it would send the whole company's rota alerts to
  //   a single phone and nothing to the staff, and because sends are logged but
  //   never thrown (lib/sms.ts), it would look like everything was working.
  //
  // Crash the boot loudly rather than fail silently.
  const FORBIDDEN_ENV_VARS = ["E2E_TEST_LOGIN", "E2E_TEST_PASSWORD", "TWILIO_TO_OVERRIDE"] as const
  const present = FORBIDDEN_ENV_VARS.filter(
    (key) => process.env[key] && process.env[key]!.trim() !== "",
  )

  if (present.length > 0) {
    throw new Error(
      `[startup] Refusing to boot: development-only environment variables are set in production:\n${present
        .map((k) => `  • ${k}`)
        .join("\n")}\n\nE2E_TEST_LOGIN / E2E_TEST_PASSWORD enable the credentials backdoor; TWILIO_TO_OVERRIDE redirects every SMS away from your staff. Remove them from this environment.`,
    )
  }
}
