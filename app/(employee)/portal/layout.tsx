import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const role = session.user?.role
  if (role === "MANAGER" || role === "ADMIN") {
    redirect("/schedule")
  }

  return <>{children}</>
}
