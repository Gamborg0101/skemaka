import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { ManagerShell } from "@/components/manager/ManagerShell"
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

  return (
    <OrgProvider>
      <BfcacheGuard />
      <ManagerShell superAdmin={isSuperadmin(session.user?.email)}>{children}</ManagerShell>
    </OrgProvider>
  )
}
