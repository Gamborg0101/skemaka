import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { VerifyPhoneClient } from "./VerifyPhoneClient"

// ISO country → E.164 dial-code prefix, so the phone field is pre-filled with the
// employee's likely country code. Mirrors the countries offered in onboarding.
const DIAL_CODES: Record<string, string> = {
  DK: "+45", SE: "+46", NO: "+47", GB: "+44", US: "+1", IE: "+353",
  DE: "+49", FR: "+33", ES: "+34", IT: "+39", NL: "+31", BE: "+32",
  AT: "+43", PT: "+351", FI: "+358",
}

export default async function VerifyPhonePage() {
  const session = await auth()
  if (!session) {
    redirect("/login?callbackUrl=/verify-phone")
  }

  const employee = await db.employee.findFirst({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: "asc" },
    include: { organization: { select: { name: true, country: true } } },
  })

  // Not an employee (e.g. a manager) — nothing to verify.
  if (!employee) {
    redirect("/portal")
  }
  // Already verified — no need to be here.
  if (employee.phoneVerifiedAt) {
    redirect("/portal")
  }

  const dialCode = employee.organization.country
    ? DIAL_CODES[employee.organization.country] ?? "+"
    : "+"

  return (
    <VerifyPhoneClient
      orgName={employee.organization.name}
      defaultDialCode={dialCode}
    />
  )
}
