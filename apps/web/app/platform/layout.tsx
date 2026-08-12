import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isSuperadmin } from "@/lib/platform"
import { PlatformShell } from "@/components/platform/PlatformShell"

/**
 * Server-side gate for /platform/*.
 *
 * These pages were client components with no authorization of their own: the only
 * thing keeping a non-superadmin out was the matcher in proxy.ts. The APIs behind
 * them each check `isSuperadmin`, so no customer data was reachable — but the
 * whole operator console would render for anyone who got past the middleware, and
 * middleware bypasses are a recurring class of framework CVE (16.2.6 shipped
 * with one). A page that must not be seen should not depend on a single layer.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) redirect("/login?callbackUrl=/platform")
  if (!isSuperadmin(session.user.email)) redirect("/schedule")

  return <PlatformShell>{children}</PlatformShell>
}
