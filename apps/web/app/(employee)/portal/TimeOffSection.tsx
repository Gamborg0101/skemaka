"use client"

import { useState, useEffect } from "react"
import { useLocale, useTranslations } from "next-intl"
import { LOCALE_TAGS, type Locale } from "@skemaka/i18n"
import { Plus, CalendarOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import type { TimeOffRequest } from "@/types"
import { fetchAllPages } from "@/lib/pagination"

const STATUS_STYLE: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  DENIED:   "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
}

const STATUS_KEY = {
  PENDING: "statusPending",
  APPROVED: "statusApproved",
  DENIED: "statusDenied",
} as const

function formatDateRange(start: string, end: string, localeTag: string) {
  const s = new Date(start + "T00:00:00Z")
  const e = new Date(end + "T00:00:00Z")
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" }
  if (start === end) return s.toLocaleDateString(localeTag, opts)
  return `${s.toLocaleDateString(localeTag, opts)} – ${e.toLocaleDateString(localeTag, { ...opts, year: "numeric" })}`
}

interface TimeOffSectionProps {
  orgId: string
}

export function TimeOffSection({ orgId }: TimeOffSectionProps) {
  const t = useTranslations("portal.timeOff")
  const tCommon = useTranslations("common")
  const localeTag = LOCALE_TAGS[useLocale() as Locale]
  const [requests, setRequests] = useState<TimeOffRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchAllPages<TimeOffRequest>(`/api/orgs/${orgId}/time-off`)
      .then((all) => setRequests(all))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orgId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate || !endDate) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/orgs/${orgId}/time-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, reason: reason.trim() || null }),
      })
      const data = await res.json() as { data?: TimeOffRequest; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? t("errSubmit"))
        return
      }
      setRequests((prev) => [data.data!, ...prev])
      setShowForm(false)
      setStartDate("")
      setEndDate("")
      setReason("")
      toast.success(t("successSubmit"))
    } catch {
      toast.error(t("errSubmit"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="px-4 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <CalendarOff className="size-4 text-gray-400 dark:text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t("title")}</h2>
        </div>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="size-3.5 mr-1" />
            {t("request")}
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 space-y-3 bg-gray-50 dark:bg-gray-800/60">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t("from")}</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (endDate && e.target.value > endDate) setEndDate(e.target.value)
                }}
                className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t("to")}</label>
              <input
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t("reasonLabel")}</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? t("submitting") : t("submit")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              {tCommon("cancel")}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <Skeleton className="h-4 w-36 mb-1.5" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full shrink-0" />
            </li>
          ))}
        </ul>
      ) : requests.length === 0 && !showForm ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">{t("noRequests")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {requests.map((r) => (
            <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {formatDateRange(r.startDate, r.endDate, localeTag)}
                </p>
                {r.reason && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.reason}</p>}
                {r.reviewNote && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">{t("note", { note: r.reviewNote })}</p>
                )}
              </div>
              <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>
                {t(STATUS_KEY[r.status as keyof typeof STATUS_KEY] ?? "statusPending")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
