import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Resend from "next-auth/providers/resend"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "@/lib/prisma"
import { authConfig } from "@/auth.config"
import type { UserRole, SubscriptionStatus } from "@/types"

/**
 * Test-only login provider for Playwright E2E. Doubly gated: the provider is only
 * registered when E2E_TEST_LOGIN === "1" AND every request must present the shared
 * E2E_TEST_PASSWORD secret. Neither var is in the production env contract
 * (instrumentation.ts), so this path cannot exist in prod. NEVER set these in a
 * production environment.
 */
const e2eProvider =
  process.env.E2E_TEST_LOGIN === "1"
    ? [
        Credentials({
          id: "e2e",
          name: "E2E Test Login",
          credentials: { email: {}, password: {} },
          async authorize(creds) {
            const secret = process.env.E2E_TEST_PASSWORD
            if (!secret || creds?.password !== secret) return null
            const email = typeof creds?.email === "string" ? creds.email.toLowerCase().trim() : ""
            if (!email) return null
            const user = await db.user.findUnique({ where: { email } })
            return user ? { id: user.id, email: user.email, name: user.name } : null
          },
        }),
      ]
    : []

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 30 * 60, updateAge: 0 },
  providers: [
    Google({ checks: ["state"] }),
    Resend({
      apiKey: process.env.RESEND_API_KEY ?? "",
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@skemaka.com",
    }),
    ...e2eProvider,
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role ?? "EMPLOYEE"
        // Cache the user's MANAGER org in the JWT so requireOrgMember skips
        // a DB lookup on every request.
        const membership = await db.membership.findFirst({
          where: { userId: user.id!, role: "MANAGER" },
          include: {
            organization: {
              select: { subscriptionStatus: true, trialEndsAt: true, pastDueSince: true },
            },
          },
          orderBy: { joinedAt: "asc" },
        })
        if (membership) {
          // Use the membership role rather than the User model's role field —
          // the User model defaults to EMPLOYEE even after org creation.
          token.role = "MANAGER"
          token.orgId = membership.organizationId
          // Cache the full billing snapshot so requireOrgMember can enforce the
          // paywall without a DB hit. Timestamps are stored as epoch millis.
          token.subscriptionStatus = membership.organization.subscriptionStatus
          token.trialEndsAt = membership.organization.trialEndsAt?.getTime() ?? null
          token.pastDueSince = membership.organization.pastDueSince?.getTime() ?? null
        } else {
          // Employee: embed orgId AND the org's billing snapshot so the same
          // paywall applies to employee-facing routes (mobile app included).
          const empMembership = await db.membership.findFirst({
            where: { userId: user.id! },
            include: {
              organization: {
                select: { subscriptionStatus: true, trialEndsAt: true, pastDueSince: true },
              },
            },
            orderBy: { joinedAt: "asc" },
          })
          if (empMembership) {
            token.orgId = empMembership.organizationId
            token.subscriptionStatus = empMembership.organization.subscriptionStatus
            token.trialEndsAt = empMembership.organization.trialEndsAt?.getTime() ?? null
            token.pastDueSince = empMembership.organization.pastDueSince?.getTime() ?? null
          }
        }
      }
      if (token.email === process.env.SUPERADMIN_EMAIL) {
        token.role = "ADMIN"
      }
      token.role ??= "EMPLOYEE"
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.orgId = token.orgId as string | undefined
        session.user.subscriptionStatus = token.subscriptionStatus as SubscriptionStatus | undefined
      }
      return session
    },
  },
})
