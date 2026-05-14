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
} satisfies NextAuthConfig
