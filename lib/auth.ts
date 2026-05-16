import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Resend from "next-auth/providers/resend"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "@/lib/prisma"
import { authConfig } from "@/auth.config"
import type { UserRole } from "@/types"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
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
          select: { organizationId: true },
          orderBy: { joinedAt: "asc" },
        })
        token.orgId = membership?.organizationId
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
        session.user.orgId = token.orgId
      }
      return session
    },
  },
})
