"use client"

import { useState, useEffect, use } from "react"
import { useLocale, useTranslations } from "next-intl"
import { LOCALE_TAGS, type Locale } from "@skemaka/i18n"
import { CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { AvailabilityRequest, Employee } from "@/types"
import { getWeekDays } from "@/lib/dateUtils"

type DayAvailability = {
  date: string
  isAvailable: boolean
  preferredStart: string
  preferredEnd: string
}

function getDayLabel(dateStr: string, localeTag: string): string {
  const label = new Date(dateStr).toLocaleDateString(localeTag, { weekday: "long" })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatDateShort(dateStr: string, localeTag: string): string {
  return new Date(dateStr).toLocaleDateString(localeTag, {
    day: "numeric",
    month: "long",
  })
}

interface PageProps {
  params: Promise<{ token: string }>
}

export default function AvailabilityTokenPage({ params }: PageProps) {
  const { token } = use(params)
  const t = useTranslations("portal.availability")
  const localeTag = LOCALE_TAGS[useLocale() as Locale]

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [request, setRequest] = useState<AvailabilityRequest | null>(null)
  const [orgName, setOrgName] = useState("")
  const [availability, setAvailability] = useState<DayAvailability[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/availability/${token}`)
      .then(async (r) => {
        if (!r.ok) { setNotFound(true); return }
        const json = await r.json() as {
          data: { employee: Employee; request: AvailabilityRequest; orgName: string }
        }
        const { employee: emp, request: req, orgName: name } = json.data
        setEmployee(emp)
        setRequest(req)
        setOrgName(name)
        setAvailability(
          getWeekDays(req.weekStart).map((date) => ({
            date,
            isAvailable: false,
            preferredStart: "",
            preferredEnd: "",
          }))
        )
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  const toggleAvailable = (date: string) => {
    setAvailability((prev) =>
      prev.map((d) => (d.date === date ? { ...d, isAvailable: !d.isAvailable } : d))
    )
  }

  const updateTime = (date: string, field: "preferredStart" | "preferredEnd", value: string) => {
    setAvailability((prev) =>
      prev.map((d) => (d.date === date ? { ...d, [field]: value } : d))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // Map to the API's contract explicitly. The UI calls these "preferred"
      // times, the API calls them startTime/endTime, and zod strips keys it
      // doesn't recognise — so posting the raw state silently dropped every
      // time an employee entered and stored null for all of them. Empty inputs
      // become null (the field is optional), and an unavailable day carries no
      // times at all, which is what the server's superRefine expects.
      const days = availability.map((d) => ({
        date: d.date,
        isAvailable: d.isAvailable,
        startTime: d.isAvailable && d.preferredStart ? d.preferredStart : null,
        endTime: d.isAvailable && d.preferredEnd ? d.preferredEnd : null,
      }))

      const r = await fetch(`/api/availability/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      })
      if (r.ok || r.status === 201) {
        setSubmitted(true)
        return
      }
      // Anything else used to fall through to nothing: the spinner stopped and
      // the employee had no idea whether it had worked. A 409 in particular is
      // routine — the manager can close the request while someone is filling
      // it in — and deserves its own explanation.
      setError(
        r.status === 409 ? t("submitClosed")
        : r.status === 429 ? t("submitTooMany")
        : t("submitFailed"),
      )
    } catch {
      setError(t("submitFailed"))
    } finally {
      setSubmitting(false)
    }
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
          <p className="mt-2 text-gray-500">
            {t("linkNotFoundHint")}
          </p>
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
          <p className="mt-2 text-gray-500">
            {t("allDoneHint")}
          </p>
          <p className="mt-6 text-sm text-gray-400">{orgName}</p>
        </div>
      </div>
    )
  }

  const weekLabel = new Date(request.weekStart).toLocaleDateString(localeTag, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {orgName}
        </p>
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

      <form onSubmit={handleSubmit} className="px-4 py-5 space-y-3 max-w-lg mx-auto">
        {availability.map((day) => (
          <div
            key={day.date}
            className={cn(
              "rounded-xl border-2 bg-white overflow-hidden transition-colors",
              day.isAvailable ? "border-blue-500" : "border-gray-200"
            )}
          >
            <button
              type="button"
              onClick={() => toggleAvailable(day.date)}
              className="flex w-full items-center justify-between px-4 py-4"
            >
              <div className="text-left">
                <p className="font-semibold text-gray-900">{getDayLabel(day.date, localeTag)}</p>
                <p className="text-sm text-gray-500">{formatDateShort(day.date, localeTag)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "text-sm font-medium",
                    day.isAvailable ? "text-blue-600" : "text-gray-400"
                  )}
                >
                  {day.isAvailable ? t("available") : t("notAvailable")}
                </span>
                <div
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    day.isAvailable ? "bg-blue-600" : "bg-gray-200"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
                      day.isAvailable ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </div>
              </div>
            </button>

            {day.isAvailable && (
              <div className="border-t border-gray-100 px-4 py-4 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`start-${day.date}`} className="text-xs text-gray-500">
                    {t("preferredStart")}
                  </Label>
                  <Input
                    id={`start-${day.date}`}
                    type="time"
                    value={day.preferredStart}
                    onChange={(e) => updateTime(day.date, "preferredStart", e.target.value)}
                    className="h-11 text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`end-${day.date}`} className="text-xs text-gray-500">
                    {t("preferredEnd")}
                  </Label>
                  <Input
                    id={`end-${day.date}`}
                    type="time"
                    value={day.preferredEnd}
                    onChange={(e) => updateTime(day.date, "preferredEnd", e.target.value)}
                    className="h-11 text-base"
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="pt-3">
          {error && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300"
            >
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 text-white"
          >
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>
    </div>
  )
}
