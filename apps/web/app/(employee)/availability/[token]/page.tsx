"use client"

import { useState, useEffect, use } from "react"
import { useLocale, useTranslations } from "next-intl"
import { LOCALE_TAGS, type Locale } from "@skemaka/i18n"
import { CheckCircle, AlertCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { AvailabilityRequest, Employee } from "@/types"
import {
  AvailabilityDaysForm,
  type AvailabilityDayInput,
} from "@/components/employee/AvailabilityDaysForm"

interface PageProps {
  params: Promise<{ token: string }>
}

/**
 * The tokenised availability link a manager mails out — no sign-in required.
 *
 * The form itself lives in AvailabilityDaysForm, shared with the signed-in
 * route at /portal/availability. This page only resolves the token and owns
 * the states a token can be in: expired, answered, or ready.
 */
export default function AvailabilityTokenPage({ params }: PageProps) {
  const { token } = use(params)
  const t = useTranslations("portal.availability")
  const localeTag = LOCALE_TAGS[useLocale() as Locale]

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [request, setRequest] = useState<AvailabilityRequest | null>(null)
  const [orgName, setOrgName] = useState("")
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch(`/api/availability/${token}`)
      .then(async (r) => {
        if (!r.ok) { setNotFound(true); return }
        const json = await r.json() as {
          data: { employee: Employee; request: AvailabilityRequest; orgName: string }
        }
        setEmployee(json.data.employee)
        setRequest(json.data.request)
        setOrgName(json.data.orgName)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  const submit = async (days: AvailabilityDayInput[]): Promise<number> => {
    const r = await fetch(`/api/availability/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    })
    return r.status
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="mx-auto w-full max-w-lg space-y-6">
          <div>
            <Skeleton className="h-7 w-48 mb-1.5" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="px-4 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-5 rounded" />
                  <div>
                    <Skeleton className="h-4 w-20 mb-1" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20 rounded-md" />
                  <Skeleton className="h-8 w-20 rounded-md" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (notFound || !employee || !request) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-gray-100">
            <AlertCircle className="size-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{t("linkNotFound")}</h1>
          <p className="mt-2 text-gray-500">{t("linkNotFoundHint")}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="size-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t("allDone")}</h1>
          <p className="mt-2 text-gray-500">{t("allDoneHint")}</p>
          <p className="mt-6 text-sm text-gray-400">{orgName}</p>
        </div>
      </div>
    )
  }

  const weekLabel = new Date(request.weekStart).toLocaleDateString(localeTag, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{orgName}</p>
        <h1 className="text-xl font-bold text-gray-900 mt-0.5">
          {t("hi", { name: employee.name.split(" ")[0] })}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t.rich("shareIntro", {
            week: weekLabel,
            b: (chunks) => <span className="font-medium text-gray-700">{chunks}</span>,
          })}
        </p>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto">
        <AvailabilityDaysForm
          weekStart={request.weekStart}
          onSubmit={submit}
          onSuccess={() => setSubmitted(true)}
        />
      </div>
    </div>
  )
}
