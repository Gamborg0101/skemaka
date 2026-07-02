import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
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

  // Require a verified phone before the portal is usable. A verified number is
  // set on every one of a user's employee rows at once (see /api/me/phone/verify),
  // so checking the first active record is sufficient. Users with no employee
  // record (e.g. managers) aren't gated.
  const employee = await db.employee.findFirst({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { phoneVerifiedAt: true },
  })
  if (employee && !employee.phoneVerifiedAt) {
    redirect("/verify-phone")
  }

  return (
    <>
      <BfcacheGuard />
      {children}
    </>
  )
}
