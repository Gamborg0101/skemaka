import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Resend from "next-auth/providers/resend"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "@/lib/prisma"
import { authConfig } from "@/auth.config"
import { isSuperadmin } from "@/lib/platform"
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

/** Org billing fields cached in the JWT for the paywall fast-path. */
const ORG_BILLING_SELECT = {
  subscriptionStatus: true,
  trialEndsAt: true,
  pastDueSince: true,
} as const

/**
 * How long a member's cached JWT claims (role, orgId, billing) are trusted
 * before the jwt callback re-checks them against the DB.
 *
 * The session is rolling (updateAge: 0) and the jwt callback only recomputes
 * claims from the DB when `user` is present (sign-in), so without this an active
 * manager's MANAGER/orgId claims would never refresh — a removed or demoted
 * manager would keep access for as long as they stay active. Re-validating on a
 * short interval bounds that window. The check is a single indexed lookup and
 * runs at most once per interval per active session. (Mobile is independently
 * covered by /api/auth/mobile/refresh, which already re-validates membership.)
 */
const CLAIM_REVALIDATE_MS = 60_000

type MutableToken = Record<string, unknown> & {
  sub?: string
  orgId?: string
  role?: string
  checkedAt?: number
}

/**
 * Re-derive role + billing for `token.orgId` straight from the DB and write the
 * result back onto the token — mirrors the sign-in logic in the jwt callback.
 * Strips the org claims entirely when the user no longer has any access to the
 * org, so requireOrgMember's slow path denies the next request.
 */
async function revalidateOrgClaims(token: MutableToken): Promise<void> {
  const userId = token.sub
  const orgId = token.orgId
  if (!userId || !orgId) return

  const [membership, activeEmployee] = await Promise.all([
    db.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      include: { organization: { select: ORG_BILLING_SELECT } },
    }),
    db.employee.findFirst({
      where: { userId, organizationId: orgId, isActive: true },
      include: { organization: { select: ORG_BILLING_SELECT } },
    }),
  ])

  const org = membership?.organization ?? activeEmployee?.organization
  if (!org) {
    // No membership and no active employee record → access revoked. Strip org
    // claims; the next requireOrgMember call falls to the slow path and 403s.
    token.role = "EMPLOYEE"
    delete token.orgId
    delete token.subscriptionStatus
    delete token.trialEndsAt
    delete token.pastDueSince
    return
  }

  // Demote a removed/changed manager; keep MANAGER only if the membership says so.
  token.role = membership?.role === "MANAGER" ? "MANAGER" : "EMPLOYEE"
  token.orgId = orgId
  token.subscriptionStatus = org.subscriptionStatus
  token.trialEndsAt = org.trialEndsAt?.getTime() ?? null
  token.pastDueSince = org.pastDueSince?.getTime() ?? null
}

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
        // Stamp the validation time so subsequent (user-less) invocations can
        // tell when the cached claims are due for a DB re-check.
        token.checkedAt = Date.now()
      } else if (
        token.orgId &&
        (typeof token.checkedAt !== "number" ||
          Date.now() - token.checkedAt > CLAIM_REVALIDATE_MS)
      ) {
        // Periodic re-validation for active sessions (no `user` on these calls).
        try {
          await revalidateOrgClaims(token as MutableToken)
          token.checkedAt = Date.now()
        } catch (err) {
          // Fail open to the cached claims: a DB blip / Neon cold start must not
          // break auth() (which is otherwise a pure JWT decode). Leave checkedAt
          // unchanged so the next request retries — the only cost of an outage is
          // a temporarily longer revocation window.
          console.error("[auth] claim re-validation failed (using cached claims):", err)
        }
      }
      // Superadmin is identified by email, not membership — restore it last so a
      // re-validation that downgraded role to EMPLOYEE can't strip ADMIN.
      if (isSuperadmin(token.email as string | null | undefined)) {
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
