import { redirect } from "next/navigation"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { auth, signOut } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { LocaleToggle } from "@/components/marketing/LocaleToggle"
import { CheckCircle2, AlertCircle } from "lucide-react"

/**
 * The employee's own account page.
 *
 * Before this existed an employee had no way to sign out from anywhere in the
 * product, no way to see whether their number was verified, and no way to
 * change language — /portal was a single page whose only link pointed at a
 * manager route. Phone verification lives here now rather than being forced as
 * a gate, so it's a thing you can come back to.
 */
export default async function EmployeeAccountPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const t = await getTranslations("portal")

  // Matched on userId first, like the portal page and layout — an employee
  // invited at one address who signs in with another is only findable this way.
  // See employeeIdentity.test.ts.
  const employee = await db.employee.findFirst({
    where: {
      isActive: true,
      OR: [
        ...(session.user.id ? [{ userId: session.user.id }] : []),
        { email: session.user.email ?? "" },
      ],
    },
    orderBy: { userId: { sort: "asc", nulls: "last" } },
    select: {
      name: true,
      phone: true,
      phoneVerifiedAt: true,
      organization: { select: { name: true } },
    },
  })

  async function doSignOut() {
    "use server"
    await signOut({ redirectTo: "/login" })
  }

  const verified = !!employee?.phoneVerifiedAt

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 space-y-5">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("accountTitle")}</h1>

      {employee && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4">
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{employee.name}</p>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {t("accountOrg")} {employee.organization.name}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t("accountPhone")}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              {verified ? (
                <CheckCircle2 className="size-4 shrink-0 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="size-4 shrink-0 text-amber-500" />
              )}
              {employee?.phone ? `${employee.phone} · ` : ""}
              {verified ? t("accountPhoneVerified") : t("accountPhoneUnverified")}
            </p>
          </div>
          {!verified && (
            <Link
              href="/verify-phone"
              className="shrink-0 inline-flex h-9 items-center rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              {t("accountVerifyCta")}
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t("accountLanguage")}</p>
          <LocaleToggle variant="light" />
        </div>
      </div>

      <form action={doSignOut}>
        <button
          type="submit"
          className="w-full h-11 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          {t("accountSignOut")}
        </button>
      </form>
    </div>
  )
}
