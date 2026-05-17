import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { ManagerShell } from "@/components/manager/ManagerShell"
import { OrgProvider } from "@/lib/orgContext"

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
  if (role !== "MANAGER" && role !== "ADMIN") {
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
      <ManagerShell>{children}</ManagerShell>
    </OrgProvider>
  )
}
