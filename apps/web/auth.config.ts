import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

// Edge-safe auth config — no Node.js-only imports (no adapter, no email provider)
// Used by proxy.ts which runs on the Edge runtime.
// lib/auth.ts extends this with the Prisma adapter and Resend provider.
// Route-level auth logic lives in proxy.ts; the authorized callback is not used.
export const authConfig = {
  providers: [Google],
  pages: {
    signIn: "/login",
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
