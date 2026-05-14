import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ManagerShell } from "@/components/manager/ManagerShell"

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

  return <ManagerShell>{children}</ManagerShell>
}
