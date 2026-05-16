import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
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
    redirect("/portal")
  }

  return (
    <OrgProvider>
      <ManagerShell>{children}</ManagerShell>
    </OrgProvider>
  )
}
