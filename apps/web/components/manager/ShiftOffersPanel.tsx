"use client"

import { useState, useEffect, useCallback } from "react"
import { Megaphone, Check, X, ChevronDown, Clock } from "lucide-react"
import { toast } from "sonner"
import { useLocale, useTranslations } from "next-intl"
import { LOCALE_TAGS, type Locale } from "@skemaka/i18n"
import { formatDayLabel, formatTime } from "@/lib/dateUtils"
import { getOrgSettings } from "@/lib/orgSettings"
import { translateServiceError, type ServiceErrorBody } from "@/lib/serviceErrorMessages"
import { useServiceErrorTranslate } from "@/lib/useServiceErrorTranslate"
import type { ShiftOffer, ShiftOfferResponse } from "@/types"

/**
 * Manager panel: open shift offers awaiting a decision. Shows who's accepted so
 * the manager can confirm a winner (creating the shift) or cancel the offer.
 * Renders nothing when there are no open offers, staying out of the way.
 */
const RESPONSE_CLASSNAME: Record<ShiftOfferResponse, string> = {
  ACCEPTED: "text-green-700 dark:text-green-400",
  DECLINED: "text-gray-400 line-through",
  PENDING:  "text-gray-400",
}

export function ShiftOffersPanel({ orgId, refreshToken }: { orgId: string; refreshToken: number }) {
  const t = useTranslations("manager.shiftOffers")
  const tCommon = useTranslations("common")
  const tToasts = useTranslations("manager.toasts")
  const translate = useServiceErrorTranslate()
  const localeTag = LOCALE_TAGS[useLocale() as Locale]
  const RESPONSE_STYLES: Record<ShiftOfferResponse, { label: string; className: string }> = {
    ACCEPTED: { label: t("responseAccepted"), className: RESPONSE_CLASSNAME.ACCEPTED },
    DECLINED: { label: t("responseDeclined"), className: RESPONSE_CLASSNAME.DECLINED },
    PENDING:  { label: t("responsePending"), className: RESPONSE_CLASSNAME.PENDING },
  }
  const [offers, setOffers] = useState<ShiftOffer[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/orgs/${orgId}/shift-offers?scope=manager`, { cache: "no-store" })
      if (!r.ok) return
      const res = (await r.json()) as { data?: ShiftOffer[] }
      setOffers(res.data ?? [])
    } catch {
      /* silent — non-critical panel */
    } finally {
      setLoaded(true)
    }
  }, [orgId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount + on refresh
  useEffect(() => { load() }, [load, refreshToken])

  async function confirm(offerId: string, employeeId: string) {
    setBusyId(offerId)
    try {
      const r = await fetch(`/api/orgs/${orgId}/shift-offers/${offerId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      })
      const res = (await r.json()) as ServiceErrorBody
      if (!r.ok) throw new Error(translateServiceError(translate, res, tCommon("somethingWentWrong")))
      toast.success(tToasts("offerConfirmed"))
      setOffers((prev) => prev.filter((o) => o.id !== offerId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon("somethingWentWrong"))
    } finally {
      setBusyId(null)
    }
  }

  async function cancel(offerId: string) {
    setBusyId(offerId)
    try {
      const r = await fetch(`/api/orgs/${orgId}/shift-offers/${offerId}/cancel`, { method: "POST" })
      const res = (await r.json()) as ServiceErrorBody
      if (!r.ok) throw new Error(translateServiceError(translate, res, tCommon("somethingWentWrong")))
      toast.success(tToasts("offerCancelled"))
      setOffers((prev) => prev.filter((o) => o.id !== offerId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon("somethingWentWrong"))
    } finally {
      setBusyId(null)
    }
  }

  if (!loaded || offers.length === 0) return null

  const tf = getOrgSettings().timeFormat
  const readyCount = offers.filter((o) => o.recipients.some((r) => r.response === "ACCEPTED")).length

  return (
    <div className="mb-3 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/70 dark:bg-indigo-950/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-indigo-100/50 dark:hover:bg-indigo-900/20 transition-colors"
      >
        <Megaphone className="size-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
          {t("title")}
          <span className="ml-1.5 rounded-full bg-indigo-200 dark:bg-indigo-900/60 px-1.5 py-px text-xs tabular-nums">
            {offers.length}
          </span>
        </p>
        {!expanded && readyCount > 0 && (
          <span className="text-[11px] font-medium text-green-700 dark:text-green-400">
            {t("readyToConfirm", { n: readyCount })}
          </span>
        )}
        <span className="ml-auto hidden sm:inline text-[11px] text-indigo-700/80 dark:text-indigo-400/80">
          {expanded ? t("confirmWhoGets") : t("tapToReview")}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-indigo-600 dark:text-indigo-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <ul className="divide-y divide-indigo-200/60 dark:divide-indigo-900/30 border-t border-indigo-200/70 dark:border-indigo-900/40">
          {offers.map((offer) => {
            const accepted = offer.recipients.filter((r) => r.response === "ACCEPTED")
            return (
              <li key={offer.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {offer.jobRole} · {formatDayLabel(offer.date, localeTag)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {formatTime(offer.startTime, tf)}–{formatTime(offer.endTime, tf)}
                    </p>
                    {offer.note && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 italic">&ldquo;{offer.note}&rdquo;</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={busyId === offer.id}
                    onClick={() => cancel(offer.id)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                  >
                    <X className="size-3.5" /> {tCommon("cancel")}
                  </button>
                </div>

                {/* Recipients + responses */}
                <ul className="mt-2 space-y-1">
                  {offer.recipients.map((rec) => {
                    const style = RESPONSE_STYLES[rec.response]
                    const canConfirm = rec.response === "ACCEPTED"
                    return (
                      <li key={rec.id} className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${rec.response === "DECLINED" ? "text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>
                          {rec.employeeName}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs ${style.className}`}>{style.label}</span>
                          {canConfirm && (
                            <button
                              type="button"
                              disabled={busyId === offer.id}
                              onClick={() => confirm(offer.id, rec.employeeId)}
                              className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
                            >
                              <Check className="size-3.5" /> {t("confirmBtn")}
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {accepted.length === 0 && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-indigo-600/80 dark:text-indigo-400/80">
                    <Clock className="size-3" /> {t("waitingForAccept")}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
