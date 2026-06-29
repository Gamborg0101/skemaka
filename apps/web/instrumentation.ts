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
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "RESEND_API_KEY",
    "NEXT_PUBLIC_APP_URL",
    "SUPERADMIN_EMAIL",
    "CRON_SECRET",
  ] as const

  const missing = REQUIRED_ENV_VARS.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === "",
  )

  if (missing.length > 0) {
    throw new Error(
      `[startup] Missing required environment variables:\n${missing.map((k) => `  • ${k}`).join("\n")}\n\nSet these in your deployment environment before starting the server.`,
    )
  }
}
