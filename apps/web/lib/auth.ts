import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Resend from "next-auth/providers/resend"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "@/lib/prisma"
import { authConfig } from "@/auth.config"
import type { UserRole, SubscriptionStatus } from "@/types"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 30 * 60, updateAge: 0 },
  providers: [
    Google,
    Resend({
      apiKey: process.env.RESEND_API_KEY ?? "",
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@skemaka.com",
    }),
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
          include: { organization: { select: { subscriptionStatus: true } } },
          orderBy: { joinedAt: "asc" },
        })
        if (membership) {
          // Use the membership role rather than the User model's role field —
          // the User model defaults to EMPLOYEE even after org creation.
          token.role = "MANAGER"
          token.orgId = membership.organizationId
          token.subscriptionStatus = membership.organization.subscriptionStatus
        }
      }
      if (token.email === process.env.ADMIN_EMAIL) {
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
