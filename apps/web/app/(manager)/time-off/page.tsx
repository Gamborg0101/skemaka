"use client"

import { useState, useEffect, useCallback } from "react"
import { Check, X, Trash2, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { useOrg } from "@/lib/orgContext"
import { useOptimisticList } from "@/lib/useOptimisticList"
import type { TimeOffRequest, Schedule, Shift } from "@/types"
import { cn } from "@/lib/utils"
import { fetchAllPages } from "@/lib/pagination"
import { getMondayOfWeek, addDays, formatTime } from "@/lib/dateUtils"
import { getOrgSettings } from "@/lib/orgSettings"
import { useLocale, useTranslations } from "next-intl"
import { LOCALE_TAGS, type Locale } from "@skemaka/i18n"

type Tab = "PENDING" | "APPROVED" | "DENIED"

const STATUS_STYLE: Record<Tab, string> = {
  PENDING:  "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
  APPROVED: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300",
  DENIED:   "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300",
}

// The copy on this page is still English by design (deep manager screen, see
// CLAUDE.md), but dates are not copy — a Danish org should read "3. aug." here
// regardless, and hardcoding en-GB is the one thing the i18n rules call out
// explicitly. The locale tag is threaded in from the component.
function formatDateRange(start: string, end: string, localeTag: string) {
  const s = new Date(start + "T00:00:00Z")
  const e = new Date(end + "T00:00:00Z")
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
  if (start === end) return s.toLocaleDateString(localeTag, opts)
  return `${s.toLocaleDateString(localeTag, { day: "numeric", month: "short", timeZone: "UTC" })} – ${e.toLocaleDateString(localeTag, opts)}`
}

function formatDayHeading(iso: string, localeTag: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString(localeTag, {
    weekday: "long", day: "numeric", month: "long",
  })
}

/** Returns the Monday ISO strings for every week that overlaps the given date range. */
function getWeeksForRange(startDate: string, endDate: string): string[] {
  const weeks: string[] = []
  let monday = getMondayOfWeek(new Date(startDate + "T12:00:00"))
  while (monday <= endDate) {
    weeks.push(monday)
    monday = addDays(monday, 7)
  }
  return weeks
}

/** Returns all ISO date strings from startDate to endDate inclusive. */
function getDaysInRange(startDate: string, endDate: string): string[] {
  const days: string[] = []
  let cur = startDate
  while (cur <= endDate) {
    days.push(cur)
    cur = addDays(cur, 1)
  }
  return days
}

export default function TimeOffPage() {
  const { orgId } = useOrg()
  const localeTag = LOCALE_TAGS[useLocale() as Locale]
  const tt = useTranslations("manager.toasts")
  const tf = getOrgSettings().timeFormat
  const [tab, setTab] = useState<Tab>("PENDING")
  const [requests, setRequests] = useState<TimeOffRequest[]>([])
  const { patch: patchRequest, remove: removeRequest } = useOptimisticList(requests, setRequests)
  // Track which orgId the current requests data was fetched for.
  // loading is derived — avoids calling setState synchronously in an effect.
  const [fetchedOrgId, setFetchedOrgId] = useState<string>("")
  const loading = fetchedOrgId !== orgId
  const [denyId, setDenyId] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState("")

  // Schedule preview
  const [viewRequest, setViewRequest] = useState<TimeOffRequest | null>(null)
  const [previewShifts, setPreviewShifts] = useState<Shift[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)

  // Reset the preview during render when a new request is selected (adjust state
  // during render pattern) — the effect below only performs the fetch.
  const [prevViewRequest, setPrevViewRequest] = useState<TimeOffRequest | null>(null)
  if (viewRequest !== prevViewRequest) {
    setPrevViewRequest(viewRequest)
    if (viewRequest) {
      setPreviewLoading(true)
      setPreviewShifts([])
    }
  }

  useEffect(() => {
    let cancelled = false
    // Load every request (the page groups/filters by status client-side).
    fetchAllPages<TimeOffRequest>(`/api/orgs/${orgId}/time-off`)
      .then((all) => {
        if (!cancelled) {
          setRequests(all)
          setFetchedOrgId(orgId)
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(tt("timeOffLoadFailed"))
          setFetchedOrgId(orgId)
        }
      })
    return () => { cancelled = true }
  }, [orgId, tt])

  // Fetch shifts for a request's date range. Pure fetch — state updates happen
  // in the effect's promise callbacks below.
  const fetchPreview = useCallback(async (req: TimeOffRequest): Promise<Shift[]> => {
    const weeks = getWeeksForRange(req.startDate, req.endDate)
    const allShifts = await Promise.all(
      weeks.map(async (weekStart) => {
        const sr = await fetch(`/api/orgs/${orgId}/schedules?weekStart=${weekStart}`)
        const sd = await sr.json() as { data: Schedule | null }
        if (!sd.data) return []
        return fetchAllPages<Shift>(`/api/orgs/${orgId}/schedules/${sd.data.id}/shifts`)
      })
    )
    const flat = allShifts.flat()
    return flat.filter((s) => s.date >= req.startDate && s.date <= req.endDate)
  }, [orgId])

  useEffect(() => {
    if (!viewRequest) return
    let cancelled = false
    fetchPreview(viewRequest)
      .then((shifts) => { if (!cancelled) setPreviewShifts(shifts) })
      .catch(() => { if (!cancelled) toast.error(tt("timeOffScheduleLoadFailed")) })
      .finally(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  }, [viewRequest, fetchPreview, tt])

  const tabs: Tab[] = ["PENDING", "APPROVED", "DENIED"]
  const filtered = requests.filter((r) => r.status === tab)

  async function handleApprove(id: string) {
    await patchRequest(id, { status: "APPROVED" as const }, async () => {
      const res = await fetch(`/api/orgs/${orgId}/time-off/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      })
      if (!res.ok) { toast.error(tt("timeOffApproveFailed")); throw new Error() }
      const data = await res.json() as { data: TimeOffRequest }
      toast.success(tt("timeOffApproved"))
      return data.data
    })
  }

  async function handleDeny(id: string) {
    if (denyId !== id) { setDenyId(id); setReviewNote(""); return }
    const note = reviewNote.trim() || undefined
    setDenyId(null)
    await patchRequest(id, { status: "DENIED" as const }, async () => {
      const res = await fetch(`/api/orgs/${orgId}/time-off/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DENIED", reviewNote: note }),
      })
      if (!res.ok) { toast.error(tt("timeOffDenyFailed")); throw new Error() }
      const data = await res.json() as { data: TimeOffRequest }
      toast.success(tt("timeOffDenied"))
      return data.data
    })
  }

  async function handleDelete(id: string) {
    await removeRequest(id, async () => {
      const res = await fetch(`/api/orgs/${orgId}/time-off/${id}`, { method: "DELETE" })
      if (!res.ok) { toast.error(tt("timeOffDeleteFailed")); throw new Error() }
      toast.success(tt("timeOffDeleted"))
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="hidden md:flex items-center px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Time Off</h1>
      </div>
      <div className="md:hidden px-4 pt-6 pb-2">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Time Off</h1>
      </div>

      <div className="flex-1 overflow-auto px-4 md:px-6 py-6 pb-20 md:pb-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit mb-6">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              tab === t ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            )}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
            <span className={cn(
              "text-xs px-1.5 py-px rounded-full font-semibold",
              tab === t ? "bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-200" : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            )}>
              {requests.filter((r) => r.status === t).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Skeleton className="size-9 rounded-full shrink-0" />
                  <div>
                    <Skeleton className="h-4 w-32 mb-1.5" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Skeleton className="h-3 w-40" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-base font-medium">No {tab.toLowerCase()} requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-4 py-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-gray-50 text-sm">{r.employee?.name}</p>
                    <span className="text-xs text-gray-400 dark:text-gray-600">·</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{r.employee?.jobRole}</p>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{formatDateRange(r.startDate, r.endDate, localeTag)}</p>
                  {r.reason && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{r.reason}</p>}
                  {r.reviewNote && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">Note: {r.reviewNote}</p>}
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status as Tab]}`}>
                  {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                </span>
              </div>

              {/* Inline deny input */}
              {denyId === r.id && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    placeholder="Reason for denial (optional)"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    autoFocus
                    className="flex-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="destructive" className="h-11 sm:h-7 px-4 sm:px-2.5" onClick={() => handleDeny(r.id)}>
                      Confirm
                    </Button>
                    <Button size="sm" variant="ghost" className="h-11 sm:h-7 px-4 sm:px-2.5" onClick={() => setDenyId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {tab === "PENDING" && (
                  <>
                    <Button
                      size="sm"
                      className="h-11 sm:h-7 px-4 sm:px-2.5 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleApprove(r.id)}
                    >
                      <Check className="size-3.5 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-11 sm:h-7 px-4 sm:px-2.5 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => handleDeny(r.id)}
                    >
                      <X className="size-3.5 mr-1" />
                      Deny
                    </Button>
                  </>
                )}
                {tab !== "PENDING" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-11 sm:h-7 px-4 sm:px-2.5 text-gray-400 hover:text-red-500"
                    onClick={() => handleDelete(r.id)}
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    Delete
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 sm:h-7 px-4 sm:px-2.5 text-gray-600 ml-auto"
                  onClick={() => setViewRequest(r)}
                >
                  <CalendarDays className="size-3.5 mr-1.5" />
                  View schedule
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule preview sheet */}
      <Sheet open={!!viewRequest} onOpenChange={(open) => { if (!open) setViewRequest(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle>{viewRequest?.employee?.name ?? "Schedule"}</SheetTitle>
            <SheetDescription>
              {viewRequest ? formatDateRange(viewRequest.startDate, viewRequest.endDate, localeTag) : ""}
              {viewRequest?.reason ? ` · ${viewRequest.reason}` : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6 space-y-4">
            {previewLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-14 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            ) : viewRequest ? (
              getDaysInRange(viewRequest.startDate, viewRequest.endDate).map((day) => {
                const dayShifts = previewShifts
                  .filter((s) => s.date === day)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))

                return (
                  <div key={day}>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      {formatDayHeading(day, localeTag)}
                    </p>
                    {dayShifts.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 pl-1">No shifts scheduled</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dayShifts.map((shift) => {
                          const isRequesting = shift.employeeId === viewRequest.employee?.id
                          return (
                            <div
                              key={shift.id}
                              className={cn(
                                "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm border",
                                isRequesting
                                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
                                  : "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700"
                              )}
                            >
                              <div className="min-w-0">
                                <p className={cn("font-medium truncate", isRequesting ? "text-amber-800 dark:text-amber-300" : "text-gray-800 dark:text-gray-200")}>
                                  {shift.employee?.name ?? "Unknown"}
                                  {isRequesting && (
                                    <span className="ml-1.5 text-xs font-normal text-amber-600 dark:text-amber-400">· requesting off</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{shift.jobRole}</p>
                              </div>
                              <p className={cn("shrink-0 text-xs font-medium tabular-nums ml-3", isRequesting ? "text-amber-700 dark:text-amber-400" : "text-gray-600 dark:text-gray-400")}>
                                {formatTime(shift.startTime, tf)}–{formatTime(shift.endTime, tf)}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      </div>
    </div>
  )
}
