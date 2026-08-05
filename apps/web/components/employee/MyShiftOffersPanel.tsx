"use client"

import { useState, useEffect, useCallback } from "react"
import { useLocale, useTranslations } from "next-intl"
import { LOCALE_TAGS, type Locale } from "@skemaka/i18n"
import { Megaphone, Check } from "lucide-react"
import { toast } from "sonner"
import { formatTime } from "@/lib/dateUtils"
import { getOrgSettings } from "@/lib/orgSettings"
import { translateServiceError, type ServiceErrorBody } from "@/lib/serviceErrorMessages"
import { useServiceErrorTranslate } from "@/lib/useServiceErrorTranslate"
import type { EmployeeShiftOffer, ShiftOfferResponse } from "@/types"

function formatDate(iso: string, localeTag: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString(localeTag, {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  })
}

function formatDeadline(iso: string, localeTag: string) {
  return new Date(iso).toLocaleDateString(localeTag, { weekday: "long", day: "numeric", month: "long" })
}

/**
 * Shifts a manager has offered the current user. They accept ("I can work it")
 * or decline; accepting makes them a candidate the manager still confirms.
 * Renders nothing when there are no open offers.
 */
export function MyShiftOffersPanel({ orgId }: { orgId: string }) {
  const t = useTranslations("portal.shiftOffers")
  const translate = useServiceErrorTranslate()
  const localeTag = LOCALE_TAGS[useLocale() as Locale]
  const [offers, setOffers] = useState<EmployeeShiftOffer[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/orgs/${orgId}/shift-offers`, { cache: "no-store" })
      if (!r.ok) return
      const res = (await r.json()) as { data?: EmployeeShiftOffer[] }
      setOffers(res.data ?? [])
    } catch {
      /* silent */
    } finally {
      setLoaded(true)
    }
  }, [orgId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
  useEffect(() => { load() }, [load])

  async function respond(id: string, response: ShiftOfferResponse) {
    setBusyId(id)
    try {
      const r = await fetch(`/api/orgs/${orgId}/shift-offers/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      })
      const res = (await r.json()) as ServiceErrorBody
      if (!r.ok) throw new Error(translateServiceError(translate, res, t("err")))
      if (response === "DECLINED") {
        setOffers((prev) => prev.filter((o) => o.id !== id))
      } else {
        setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, myResponse: "ACCEPTED" } : o)))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("err"))
    } finally {
      setBusyId(null)
    }
  }

  if (!loaded || offers.length === 0) return null

  const tf = getOrgSettings().timeFormat

  return (
    <div className="mb-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/20 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-indigo-200/70 dark:border-indigo-900/40">
        <Megaphone className="size-4 text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">{t("title")}</p>
      </div>
      <ul className="divide-y divide-indigo-200/50 dark:divide-indigo-900/30">
        {offers.map((offer) => (
          <li key={offer.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {offer.jobRole} · {formatDate(offer.date, localeTag)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {formatTime(offer.startTime, tf)}–{formatTime(offer.endTime, tf)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {t("respondBy", { date: formatDeadline(offer.deadline, localeTag) })}
                </p>
                {offer.note && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 italic">&ldquo;{offer.note}&rdquo;</p>
                )}
              </div>
              {offer.myResponse !== "ACCEPTED" && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busyId === offer.id}
                    onClick={() => respond(offer.id, "ACCEPTED")}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                  >
                    {busyId === offer.id ? t("saving") : t("accept")}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === offer.id}
                    onClick={() => respond(offer.id, "DECLINED")}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                  >
                    {t("decline")}
                  </button>
                </div>
              )}
            </div>
            {offer.myResponse === "ACCEPTED" && (
              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                <Check className="size-3.5" /> {t("accepted")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
