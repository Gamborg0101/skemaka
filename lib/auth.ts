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
      }
      // Re-check ADMIN on every callback (sign-in and refresh) so the role is
      // never silently lost if the token is re-issued without a user object.
      if (token.email === process.env.ADMIN_EMAIL) {
        token.role = "ADMIN"
        // TODO: persist ADMIN role to DB: db.user.update({ where: { id: user?.id ?? token.sub! }, data: { role: "ADMIN" } })
      }
      // Guarantee role is always present — fallback for tokens issued before
      // this field existed, or if the if (user) branch was somehow skipped.
      token.role ??= "EMPLOYEE"
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
      }
      return session
    },
  },
})
