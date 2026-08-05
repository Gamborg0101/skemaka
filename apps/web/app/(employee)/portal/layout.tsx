import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { BfcacheGuard } from "@/components/BfcacheGuard"
import { EmployeeNav } from "@/components/employee/EmployeeNav"
import { PhoneVerifyBanner } from "@/components/employee/PhoneVerifyBanner"

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  // This layout used to redirect an unverified employee to /verify-phone, which
  // has no skip, no link and no recovery — so anyone whose SMS didn't arrive
  // (wrong country code, carrier delay, a Twilio restriction) could never see
  // their own schedule again, and their manager couldn't fix it, because they
  // were already added.
  //
  // A verified number is what SMS shift notifications need. It is not what
  // reading your own roster needs. So the portal is open and the banner below
  // keeps asking. The number stays unverified until they act, so nothing is
  // texted to an unconfirmed phone.
  //
  // Matched on userId, like the page beside it — see employeeIdentity.test.ts
  // for why the two must not drift apart.
  const employee = await db.employee.findFirst({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { phoneVerifiedAt: true },
  })

  return (
    <>
      <BfcacheGuard />
      {/* pb-16 keeps the last of the page clear of the fixed bottom nav. */}
      <div className="pb-16">
        {employee && !employee.phoneVerifiedAt && <PhoneVerifyBanner />}
        {children}
      </div>
      <EmployeeNav />
    </>
  )
}
