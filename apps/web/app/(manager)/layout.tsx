import { redirect } from "next/navigation"
import { auth, signIn, signOut } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { deleteDemoSandbox } from "@/lib/cleanup"
import { ManagerShell } from "@/components/manager/ManagerShell"
import { DemoBanner } from "@/components/manager/DemoBanner"
import { OrgProvider } from "@/lib/orgContext"
import { BfcacheGuard } from "@/components/BfcacheGuard"
import { isSuperadmin } from "@/lib/platform"

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const role = session.user?.role
  // The super admin always gets in (they manage restaurants via acting-as and may
  // not be a manager of any org themselves).
  if (role !== "MANAGER" && role !== "ADMIN" && !isSuperadmin(session.user?.email)) {
    // Slow path: JWT role may be stale (e.g. user just created an org in this session).
    // Check DB for a manager membership before gating them out.
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id, role: "MANAGER" },
      orderBy: { joinedAt: "asc" },
    })
    if (!membership) redirect("/onboarding")
    // else: they have a membership — JWT is stale, let OrgProvider handle the rest
  }

  // Demo-sandbox exit: sign the visitor out of the throwaway demo user before
  // sending them to signup — an authenticated /login visit would bounce back.
  async function exitDemo() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  /**
   * Reset the sandbox: throw this one away and sign in to a fresh one.
   *
   * A visitor who has just deleted half the roster to see what happens has no
   * way back otherwise, and "start over" is the thing you want after breaking
   * something on purpose. Deletion is guarded on `isDemo` in deleteDemoSandbox,
   * and re-entry goes through the normal demo provider, so the rate limit and
   * the concurrent-sandbox cap still apply exactly as on a first visit.
   */
  async function resetDemo() {
    "use server"
    const current = await auth()
    const orgId = current?.user?.orgId
    if (orgId) await deleteDemoSandbox(orgId)
    await signIn("demo", { redirectTo: "/schedule" })
  }

  return (
    <OrgProvider>
      <BfcacheGuard />
      <DemoBanner exitAction={exitDemo} resetAction={resetDemo} />
      <ManagerShell superAdmin={isSuperadmin(session.user?.email)}>{children}</ManagerShell>
    </OrgProvider>
  )
}
