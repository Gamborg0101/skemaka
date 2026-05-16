import type { DefaultSession } from "next-auth"
import type { UserRole, SubscriptionStatus } from "./index"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
      orgId?: string
      subscriptionStatus?: SubscriptionStatus
    } & DefaultSession["user"]
  }

  interface User {
    role?: UserRole
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string
    role?: UserRole
    orgId?: string
    subscriptionStatus?: string
  }
}
