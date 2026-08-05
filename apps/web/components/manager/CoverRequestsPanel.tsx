"use client"

import { useState, useEffect, useCallback } from "react"
import { ArrowLeftRight, Check, X, MapPin, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { useLocale, useTranslations } from "next-intl"
import { LOCALE_TAGS, type Locale } from "@skemaka/i18n"
import { useOrg } from "@/lib/orgContext"
import { formatDayLabel, formatTime } from "@/lib/dateUtils"
import { getOrgSettings } from "@/lib/orgSettings"
import { translateServiceError, type ServiceErrorBody } from "@/lib/serviceErrorMessages"
import { useServiceErrorTranslate } from "@/lib/useServiceErrorTranslate"
import type { CoverRequest } from "@/types"

/** What the schedule should highlight for a request the manager is reviewing. */
export type CoverFocus = {
  date: string
  requesterEmployeeId: string
  requesterName: string
  claimedByEmployeeId: string | null
  claimedByName: string | null
}

/**
 * Manager panel: pending shift-cover requests to approve/deny. Renders nothing
 * when there's nothing to review, so it stays out of the way on a quiet week.
 *
 * Selecting a request calls `onFocus` so the schedule can highlight the shift
 * being given up (source) and where it would move (destination).
 */
export function CoverRequestsPanel({ onFocus }: { onFocus?: (f: CoverFocus | null) => void }) {
  const t = useTranslations("manager.coverRequests")
  const tToasts = useTranslations("manager.toasts")
  const tCommon = useTranslations("common")
  const translate = useServiceErrorTranslate()
  const localeTag = LOCALE_TAGS[useLocale() as Locale]
  const { orgId } = useOrg()
  const [requests, setRequests] = useState<CoverRequest[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/orgs/${orgId}/cover-requests?scope=manager`, { cache: "no-store" })
      if (!r.ok) return
      const res = (await r.json()) as { data?: CoverRequest[] }
      setRequests(res.data ?? [])
    } catch {
      /* silent — non-critical panel */
    } finally {
      setLoaded(true)
    }
  }, [orgId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
  useEffect(() => { load() }, [load])

  function clearSelection() {
    setSelectedId(null)
    onFocus?.(null)
  }

  function select(req: CoverRequest) {
    if (selectedId === req.id) { clearSelection(); return }
    setSelectedId(req.id)
    onFocus?.({
      date: req.shift.date,
      requesterEmployeeId: req.requesterEmployeeId,
      requesterName: req.requesterName,
      claimedByEmployeeId: req.claimedByEmployeeId,
      claimedByName: req.claimedByName,
    })
  }

  async function act(id: string, action: "approve" | "deny") {
    setBusyId(id)
    try {
      const r = await fetch(`/api/orgs/${orgId}/cover-requests/${id}/${action}`, { method: "POST" })
      const res = (await r.json()) as ServiceErrorBody
      if (!r.ok) throw new Error(translateServiceError(translate, res, tCommon("somethingWentWrong")))
      toast.success(action === "approve" ? tToasts("coverApproved") : tToasts("coverDenied"))
      setRequests((prev) => prev.filter((req) => req.id !== id))
      if (id === selectedId) clearSelection()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon("somethingWentWrong"))
    } finally {
      setBusyId(null)
    }
  }

  if (!loaded || requests.length === 0) return null

  const tf = getOrgSettings().timeFormat
  const readyCount = requests.filter((r) => r.status === "CLAIMED").length

  function toggle() {
    setExpanded((e) => {
      const next = !e
      // Collapsing hides the list, so drop any schedule highlight too.
      if (!next) clearSelection()
      return next
    })
  }

  return (
    <div className="mb-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 overflow-hidden">
      {/* Collapsed by default — a compact header you expand to review requests. */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
      >
        <ArrowLeftRight className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          {t("title")}
          <span className="ml-1.5 rounded-full bg-amber-200 dark:bg-amber-900/60 px-1.5 py-px text-xs tabular-nums">
            {requests.length}
          </span>
        </p>
        {!expanded && readyCount > 0 && (
          <span className="text-[11px] font-medium text-green-700 dark:text-green-400">
            {t("readyToApprove", { n: readyCount })}
          </span>
        )}
        <span className="ml-auto hidden sm:inline text-[11px] text-amber-700/80 dark:text-amber-400/80">
          {expanded ? t("tapToShowOnSchedule") : t("tapToReview")}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-amber-600 dark:text-amber-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
      <ul className="divide-y divide-amber-200/60 dark:divide-amber-900/30 border-t border-amber-200/70 dark:border-amber-900/40">
        {requests.map((req) => {
          const claimed = req.status === "CLAIMED" && req.claimedByName
          const isSelected = selectedId === req.id
          return (
            <li key={req.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-colors ${isSelected ? "bg-amber-100/70 dark:bg-amber-900/30" : ""}`}>
              <button
                type="button"
                onClick={() => select(req)}
                aria-pressed={isSelected}
                className="min-w-0 flex-1 text-left text-sm cursor-pointer group"
              >
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate flex items-center gap-1">
                  {t("requesterShift", { name: req.requesterName, jobRole: req.shift.jobRole })}
                  <MapPin className={`size-3 shrink-0 transition-opacity ${isSelected ? "text-amber-600 opacity-100" : "text-amber-500 opacity-0 group-hover:opacity-70"}`} />
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {formatDayLabel(req.shift.date, localeTag)} · {formatTime(req.shift.startTime, tf)}–{formatTime(req.shift.endTime, tf)}
                </p>
                <p className="text-xs mt-0.5">
                  {claimed ? (
                    <span className="text-green-700 dark:text-green-400 font-medium">{t("willCover", { name: req.claimedByName ?? "" })}</span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">{t("waitingForTeammate")}</span>
                  )}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={!claimed || busyId === req.id}
                  onClick={() => act(req.id, "approve")}
                  title={claimed ? t("approveTooltipReady") : t("approveTooltipWaiting")}
                  className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Check className="size-3.5" /> {t("approveBtn")}
                </button>
                <button
                  type="button"
                  disabled={busyId === req.id}
                  onClick={() => act(req.id, "deny")}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                >
                  <X className="size-3.5" /> {t("denyBtn")}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      )}
    </div>
  )
}
