"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { LOCALE_TAGS, type Locale } from "@skemaka/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { getWeekDays } from "@/lib/dateUtils"

/**
 * The seven-day availability form, shared by the tokenised link a manager
 * mails out and the standing /portal/availability route.
 *
 * It speaks the API's vocabulary — `startTime` / `endTime`, null when blank —
 * rather than the UI's old `preferredStart` / `preferredEnd`. That mismatch is
 * what silently dropped every time an employee entered: zod strips keys it
 * doesn't recognise, so the request succeeded and stored nulls. Keeping one
 * component means the translation happens once, here, or not at all.
 *
 * The caller owns the request (token endpoint vs. org endpoint) and passes it
 * in as `onSubmit`, returning the HTTP status so this component can explain
 * what happened in the employee's language.
 */

export type AvailabilityDayInput = {
  date: string
  isAvailable: boolean
  startTime: string | null
  endTime: string | null
}

type DayState = {
  date: string
  isAvailable: boolean
  startTime: string
  endTime: string
}

interface Props {
  weekStart: string
  /** An existing submission to prefill from, so reopening the form isn't a blank slate. */
  initial?: AvailabilityDayInput[]
  /** Performs the request. Resolve with the HTTP status; throw or resolve 0 for a network failure. */
  onSubmit: (days: AvailabilityDayInput[]) => Promise<number>
  onSuccess?: () => void
  submitLabel?: string
}

function getDayLabel(dateStr: string, localeTag: string): string {
  const label = new Date(dateStr).toLocaleDateString(localeTag, { weekday: "long", timeZone: "UTC" })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatDateShort(dateStr: string, localeTag: string): string {
  return new Date(dateStr).toLocaleDateString(localeTag, {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })
}

function buildInitialState(weekStart: string, initial?: AvailabilityDayInput[]): DayState[] {
  const byDate = new Map((initial ?? []).map((d) => [d.date, d]))
  return getWeekDays(weekStart).map((date) => {
    const prior = byDate.get(date)
    return {
      date,
      isAvailable: prior?.isAvailable ?? false,
      startTime: prior?.startTime ?? "",
      endTime: prior?.endTime ?? "",
    }
  })
}

export function AvailabilityDaysForm({ weekStart, initial, onSubmit, onSuccess, submitLabel }: Props) {
  const t = useTranslations("portal.availability")
  const localeTag = LOCALE_TAGS[useLocale() as Locale]

  const [days, setDays] = useState<DayState[]>(() => buildInitialState(weekStart, initial))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleAvailable = (date: string) => {
    setDays((prev) => prev.map((d) => (d.date === date ? { ...d, isAvailable: !d.isAvailable } : d)))
  }

  const updateTime = (date: string, field: "startTime" | "endTime", value: string) => {
    setDays((prev) => prev.map((d) => (d.date === date ? { ...d, [field]: value } : d)))
  }

  // An unavailable day carries no times at all, and a blank input is null
  // rather than "" — both are what the server's superRefine expects.
  const toPayload = (): AvailabilityDayInput[] =>
    days.map((d) => ({
      date: d.date,
      isAvailable: d.isAvailable,
      startTime: d.isAvailable && d.startTime ? d.startTime : null,
      endTime: d.isAvailable && d.endTime ? d.endTime : null,
    }))

  // Caught here rather than at submit time so someone can't stare at a
  // rejected request wondering which of seven rows the server disliked.
  const invalidDay = days.find(
    (d) => d.isAvailable && d.startTime && d.endTime && d.endTime <= d.startTime,
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (invalidDay) {
      setError(t("errEndBeforeStart", { day: getDayLabel(invalidDay.date, localeTag) }))
      return
    }
    setSubmitting(true)
    try {
      const status = await onSubmit(toPayload())
      if (status === 200 || status === 201) {
        onSuccess?.()
        return
      }
      // Anything else used to fall through to nothing: the spinner stopped and
      // the employee had no idea whether it had worked. A 409 in particular is
      // routine — the manager can close the request while someone is filling
      // it in — and deserves its own explanation.
      setError(
        status === 409 ? t("submitClosed")
        : status === 429 ? t("submitTooMany")
        : t("submitFailed"),
      )
    } catch {
      setError(t("submitFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {days.map((day) => (
        <div
          key={day.date}
          className={cn(
            "rounded-xl border-2 bg-white dark:bg-gray-900 overflow-hidden transition-colors",
            day.isAvailable ? "border-blue-500" : "border-gray-200 dark:border-gray-700",
          )}
        >
          <button
            type="button"
            onClick={() => toggleAvailable(day.date)}
            aria-pressed={day.isAvailable}
            className="flex w-full items-center justify-between px-4 py-4"
          >
            <div className="text-left">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {getDayLabel(day.date, localeTag)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatDateShort(day.date, localeTag)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "text-sm font-medium",
                  day.isAvailable ? "text-blue-600 dark:text-blue-400" : "text-gray-400",
                )}
              >
                {day.isAvailable ? t("available") : t("notAvailable")}
              </span>
              <div
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  day.isAvailable ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700",
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
                    day.isAvailable ? "translate-x-5" : "translate-x-0",
                  )}
                />
              </div>
            </div>
          </button>

          {day.isAvailable && (
            <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-4 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`start-${day.date}`} className="text-xs text-gray-500">
                  {t("preferredStart")}
                </Label>
                <Input
                  id={`start-${day.date}`}
                  type="time"
                  value={day.startTime}
                  onChange={(e) => updateTime(day.date, "startTime", e.target.value)}
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
                  value={day.endTime}
                  onChange={(e) => updateTime(day.date, "endTime", e.target.value)}
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
          {submitting ? t("submitting") : (submitLabel ?? t("submit"))}
        </Button>
      </div>
    </form>
  )
}
