import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

// Edge-safe auth config — no Node.js-only imports (no adapter, no email provider)
// Used by proxy.ts which runs on the Edge runtime.
// lib/auth.ts extends this with the Prisma adapter and Resend provider.
// Route-level auth logic lives in proxy.ts; the authorized callback is not used.
export const authConfig = {
  // PKCE + state, which is Auth.js's default for Google.
  //
  // `checks: ["state"]` alone shipped in May 2026 while the mobile OAuth flow was
  // being built (7c6b214), dropping PKCE from every sign-in, web included. State
  // covers CSRF, so this was not a hole — but PKCE is what stops an intercepted
  // authorization code being redeemed by anyone but us, and there is no reason
  // for the web app to go without it.
  //
  // If mobile Google sign-in regresses, that flow is the reason the check was
  // removed: it leaves the app for the system browser and comes back through
  // /api/auth/mobile/complete, and the code_verifier cookie has to survive the
  // round trip. Fix it there (cookie sameSite/partitioning) rather than by
  // weakening every browser sign-in again.
  providers: [Google({ checks: ["pkce", "state"] })],
  pages: {
    signIn: "/login",
    // Without this, provider-level failures (expired magic link, OAuth error)
    // render NextAuth's stock /api/auth/error page — an unstyled <h1>Error</h1>
    // shipping default CSS for a dozen OAuth providers we don't use. Pointing
    // it at /login reuses the branded, localized message there; NextAuth
    // appends ?error=<code>, which the page now reads.
    error: "/login",
    // Same reasoning as `error` above: the stock verify-request page is an
    // unstyled English "Check your email", shown mid-flow to someone who has
    // just read a Danish login screen. /check-email is the branded, localized
    // equivalent.
    verifyRequest: "/check-email",
  },
  session: {
    // 30-minute inactivity timeout. The Edge middleware re-signs the JWT on every
    // authenticated request (updateAge: 0), sliding the expiry window forward.
    // If no request arrives within 30 minutes the JWT expires naturally — the next
    // request sees a null session and is rejected by proxy.ts.
    // lib/auth.ts repeats these values because its `session` key shallow-overwrites
    // whatever is spread from this config.
    maxAge: 30 * 60,
    updateAge: 0,
  },
} satisfies NextAuthConfig
