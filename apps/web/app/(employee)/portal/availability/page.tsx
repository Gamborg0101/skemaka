import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { CalendarCheck } from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
import * as availabilityService from "@/lib/services/availabilityService"
import {
  AvailabilityRequestList,
  type AvailabilityRequestItem,
} from "@/components/employee/AvailabilityRequestList"

/**
 * The employee's standing availability page.
 *
 * The list, submit and my-submission endpoints all existed already, guarded by
 * requireOrgMember and reachable by any employee — with nothing rendering
 * them. The only route into the form was a tokenised link mailed per request,
 * so an employee who lost the mail, or whose token expired, had no way to tell
 * their manager when they could work.
 */
export default async function PortalAvailabilityPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const t = await getTranslations("portal")
  const ta = await getTranslations("portal.availability")

  // Matched on the linked account first, email second — the same lookup as the
  // portal page, layout and account page. See employeeIdentity.test.ts.
  const employee = await db.employee.findFirst({
    where: {
      isActive: true,
      OR: [
        ...(session.user.id ? [{ userId: session.user.id }] : []),
        { email: session.user.email ?? "" },
      ],
    },
    orderBy: { userId: { sort: "asc", nulls: "last" } },
    select: { id: true, organizationId: true },
  })

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("noProfile")}</p>
        <p className="mt-1 text-sm text-gray-500">{t("noProfileHint")}</p>
      </div>
    )
  }

  const open = await availabilityService.listOpenForEmployee(employee.organizationId, employee.id)

  const items: AvailabilityRequestItem[] = open.map(({ request, submission }) => ({
    requestId: request.id,
    weekStart: request.weekStart,
    deadline: request.deadline,
    answered: submission !== null,
    // `days` is optional on the shared type — the serializer only attaches it
    // when the query included it, which listOpenForEmployee always does.
    days:
      submission?.days?.map((d) => ({
        date: d.date,
        isAvailable: d.isAvailable,
        startTime: d.startTime ?? null,
        endTime: d.endTime ?? null,
      })) ?? [],
  }))

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{ta("title")}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{ta("intro")}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-12 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <CalendarCheck className="size-6 text-gray-400" />
          </div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{ta("none")}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{ta("noneHint")}</p>
        </div>
      ) : (
        <AvailabilityRequestList orgId={employee.organizationId} items={items} />
      )}
    </div>
  )
}
