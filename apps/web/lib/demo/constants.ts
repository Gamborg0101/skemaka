/**
 * Shared demo-sandbox constants. Kept dependency-free so lib/resend.ts,
 * lib/auth.ts, and lib/cleanup.ts can import them without pulling in Prisma.
 */

/**
 * All demo users and demo employees get addresses on this unroutable domain.
 * lib/resend.ts refuses to deliver to it, so a sandbox can never email anyone,
 * and lib/cleanup.ts uses it to find orphaned demo users.
 */
export const DEMO_EMAIL_DOMAIN = "demo.skemaka.dev"

/** Sandboxes are deleted by the cleanup cron once they're older than this. */
export const DEMO_TTL_HOURS = 48

/** Hard ceiling on concurrent sandboxes — bounds abuse of the public entry point. */
export const DEMO_MAX_CONCURRENT = 300
