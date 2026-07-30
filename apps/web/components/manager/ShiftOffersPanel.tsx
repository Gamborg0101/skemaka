"use client"

import { useState, useEffect, useCallback } from "react"
import { Megaphone, Check, X, ChevronDown, Clock } from "lucide-react"
import { toast } from "sonner"
import { formatDayLabel, formatTime } from "@/lib/dateUtils"
import { getOrgSettings } from "@/lib/orgSettings"
import type { ShiftOffer, ShiftOfferResponse } from "@/types"

const RESPONSE_STYLES: Record<ShiftOfferResponse, { label: string; className: string }> = {
  ACCEPTED: { label: "Accepted", className: "text-green-700 dark:text-green-400" },
  DECLINED: { label: "Declined", className: "text-gray-400 line-through" },
  PENDING:  { label: "No reply yet", className: "text-gray-400" },
}

/**
 * Manager panel: open shift offers awaiting a decision. Shows who's accepted so
 * the manager can confirm a winner (creating the shift) or cancel the offer.
 * Renders nothing when there are no open offers, staying out of the way.
 */
export function ShiftOffersPanel({ orgId, refreshToken }: { orgId: string; refreshToken: number }) {
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
      const res = (await r.json()) as { error?: string }
      if (!r.ok) throw new Error(res.error ?? "Something went wrong")
      toast.success("Shift confirmed — it's on the schedule")
      setOffers((prev) => prev.filter((o) => o.id !== offerId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusyId(null)
    }
  }

  async function cancel(offerId: string) {
    setBusyId(offerId)
    try {
      const r = await fetch(`/api/orgs/${orgId}/shift-offers/${offerId}/cancel`, { method: "POST" })
      const res = (await r.json()) as { error?: string }
      if (!r.ok) throw new Error(res.error ?? "Something went wrong")
      toast.success("Offer cancelled")
      setOffers((prev) => prev.filter((o) => o.id !== offerId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
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
          Shift offers
          <span className="ml-1.5 rounded-full bg-indigo-200 dark:bg-indigo-900/60 px-1.5 py-px text-xs tabular-nums">
            {offers.length}
          </span>
        </p>
        {!expanded && readyCount > 0 && (
          <span className="text-[11px] font-medium text-green-700 dark:text-green-400">
            {readyCount} ready to confirm
          </span>
        )}
        <span className="ml-auto hidden sm:inline text-[11px] text-indigo-700/80 dark:text-indigo-400/80">
          {expanded ? "Confirm who gets each shift" : "Tap to review"}
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
                      {offer.jobRole} · {formatDayLabel(offer.date)}
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
                    <X className="size-3.5" /> Cancel
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
                              <Check className="size-3.5" /> Confirm
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {accepted.length === 0 && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-indigo-600/80 dark:text-indigo-400/80">
                    <Clock className="size-3" /> Waiting for someone to accept
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
