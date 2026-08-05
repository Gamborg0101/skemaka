"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { LOCALE_TAGS, type Locale } from "@skemaka/i18n"
import { CheckCircle2, CalendarClock, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  AvailabilityDaysForm,
  type AvailabilityDayInput,
} from "@/components/employee/AvailabilityDaysForm"

export type AvailabilityRequestItem = {
  requestId: string
  weekStart: string
  deadline: string
  answered: boolean
  days: AvailabilityDayInput[]
}

interface Props {
  orgId: string
  items: AvailabilityRequestItem[]
}

/**
 * The open availability requests an employee can answer from inside the app.
 *
 * Unanswered requests open expanded, because that's the thing the employee
 * came here to do. An answered one collapses to its badge — it can still be
 * changed while the request is open, which the tokenised email link never
 * allowed: that form always reopened blank and overwrote the previous answer
 * with a week of "unavailable".
 */
export function AvailabilityRequestList({ orgId, items }: Props) {
  const t = useTranslations("portal.availability")
  const localeTag = LOCALE_TAGS[useLocale() as Locale]
  const router = useRouter()

  const [openId, setOpenId] = useState<string | null>(
    items.find((i) => !i.answered)?.requestId ?? null,
  )
  const [justSaved, setJustSaved] = useState<string | null>(null)

  const submit = (requestId: string) => async (days: AvailabilityDayInput[]): Promise<number> => {
    const r = await fetch(`/api/orgs/${orgId}/availability/${requestId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    })
    return r.status
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(localeTag, {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    })

  // The deadline is a real timestamp (end of day), not a calendar date, so it
  // is formatted in the reader's own zone rather than forced to UTC.
  const formatDeadline = (iso: string) =>
    new Date(iso).toLocaleDateString(localeTag, { day: "numeric", month: "long" })

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const expanded = openId === item.requestId
        const saved = justSaved === item.requestId
        return (
          <div
            key={item.requestId}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenId(expanded ? null : item.requestId)}
              aria-expanded={expanded}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {t("weekOf", { week: formatDate(item.weekStart) })}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                  <CalendarClock className="size-4 shrink-0" />
                  {t("deadlineLabel", { date: formatDeadline(item.deadline) })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.answered || saved ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-950/50 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-300">
                    <CheckCircle2 className="size-3.5" />
                    {t("answered")}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    {t("notAnswered")}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "size-4 text-gray-400 transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </div>
            </button>

            {expanded && (
              <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-4">
                <AvailabilityDaysForm
                  weekStart={item.weekStart}
                  initial={item.days}
                  onSubmit={submit(item.requestId)}
                  submitLabel={item.answered ? t("saveChanges") : undefined}
                  onSuccess={() => {
                    setJustSaved(item.requestId)
                    setOpenId(null)
                    // Re-read from the server so a reload shows the same thing
                    // this list now claims.
                    router.refresh()
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
