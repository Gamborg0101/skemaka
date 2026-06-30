import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { BfcacheGuard } from "@/components/BfcacheGuard"

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  return (
    <>
      <BfcacheGuard />
      {children}
    </>
  )
}
