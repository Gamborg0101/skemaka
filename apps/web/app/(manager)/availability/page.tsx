"use client"

import { useState, useEffect, useCallback } from "react"
import { Send, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AvailabilityGrid } from "@/components/manager/AvailabilityGrid"
import { AddShiftDialog } from "@/components/manager/AddShiftDialog"
import { SendAvailabilityDialog } from "@/components/manager/SendAvailabilityDialog"
import { toast } from "sonner"
import { useOrg } from "@/lib/orgContext"
import { getMondayOfWeek, addDays, getISOWeek, formatWeekLabel } from "@/lib/dateUtils"
import type { AvailabilityRequest, Employee, Shift, Schedule } from "@/types"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchAllPages } from "@/lib/pagination"

type AvailabilitySubmission = NonNullable<AvailabilityRequest["submissions"]>[number]

export default function AvailabilityPage() {
  const { orgId, jobRoles, shiftTemplates } = useOrg()

  // All known requests — used only to look up whether a request exists for the current week
  const [allRequests, setAllRequests] = useState<AvailabilityRequest[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  // Free-roaming week cursor (same pattern as the schedule page)
  const [weekStart, setWeekStart] = useState<string>(getMondayOfWeek(new Date()))

  // Data for the current week
  const [request, setRequest] = useState<AvailabilityRequest | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [scheduleId, setScheduleId] = useState<string | null>(null)

  // initialLoaded tracks whether the first fetch (employees + all requests) is done.
  // Using a boolean flag avoids calling setState synchronously at the top of an effect.
  const [initialLoaded, setInitialLoaded] = useState(false)
  const loading = !initialLoaded
  const [sending, setSending] = useState(false)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [bookDialog, setBookDialog] = useState<{
    open: boolean; employeeId: string; date: string; startTime: string; endTime: string
  }>({ open: false, employeeId: "", date: "", startTime: "09:00", endTime: "17:00" })

  // Load employees + all requests once
  useEffect(() => {
    if (!orgId) return
    Promise.all([
      fetchAllPages<Employee>(`/api/orgs/${orgId}/employees`),
      fetchAllPages<AvailabilityRequest>(`/api/orgs/${orgId}/availability`),
    ]).then(([emps, reqs]) => {
      setEmployees(emps)
      setAllRequests(reqs)

      // Jump to the most recent request's week if one exists
      if (reqs[0]?.weekStart) setWeekStart(reqs[0].weekStart)

      setInitialLoaded(true)
    }).catch(() => setInitialLoaded(true))
  }, [orgId])

  // Whenever the week changes (after initial load), load the matching request + schedule
  useEffect(() => {
    if (!orgId || !initialLoaded) return
    let cancelled = false

    const matched = allRequests.find((r) => r.weekStart === weekStart) ?? null

    async function load() {
      // Fetch request submissions (if a request exists for this week)
      let fullRequest: AvailabilityRequest | null = matched
      if (matched) {
        try {
          const subs = await fetchAllPages<AvailabilitySubmission>(
            `/api/orgs/${orgId}/availability/${matched.id}/submissions`,
          )
          if (!cancelled) fullRequest = { ...matched, submissions: subs }
        } catch { /* leave request without submissions */ }
      }

      // Fetch schedule for this week
      try {
        const schedRes = await fetch(`/api/orgs/${orgId}/schedules?weekStart=${weekStart}`)
        const schedJson = await schedRes.json()
        if (!cancelled) {
          const sched: Schedule | null = schedJson.data
          setScheduleId(sched?.id ?? null)
          setShifts(sched?.shifts ?? [])
        }
      } catch { /* leave shifts empty */ }

      if (!cancelled) setRequest(fullRequest)
    }

    load()
    return () => { cancelled = true }
  }, [orgId, weekStart, allRequests, initialLoaded])

  const navigateWeek = (dir: -1 | 1) => {
    setWeekStart((ws) => addDays(ws, dir * 7))
    setRequest(null)
    setShifts([])
    setScheduleId(null)
  }

  const handleBookShift = (
    employeeId: string, date: string, startTime: string | null, endTime: string | null
  ) => {
    setBookDialog({ open: true, employeeId, date, startTime: startTime ?? "09:00", endTime: endTime ?? "17:00" })
  }

  const handleShiftCreate = useCallback(
    async (data: {
      employeeId: string; date: string; startTime: string; endTime: string
      breakMinutes: number; jobRole: string; notes: string | null; colorTag: string | null
    }) => {
      let sid = scheduleId
      if (!sid) {
        try {
          const r = await fetch(`/api/orgs/${orgId}/schedules`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ weekStart }),
          })
          const json = await r.json() as { data?: Schedule }
          sid = json.data?.id ?? null
          if (sid) setScheduleId(sid)
          else { toast.error("Failed to get schedule"); return }
        } catch {
          toast.error("Failed to get schedule")
          return
        }
      }

      const tempId = crypto.randomUUID()
      const optimistic: Shift = {
        id: tempId, scheduleId: sid, organizationId: orgId,
        ...data, cancelledAt: null, publishedAt: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      setShifts((prev) => [...prev, optimistic])

      try {
        const r = await fetch(`/api/orgs/${orgId}/schedules/${sid}/shifts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        const res = await r.json() as { data?: Shift }
        if (res.data) {
          setShifts((prev) => prev.map((s) => (s.id === tempId ? res.data! : s)))
          toast.success("Shift booked")
        } else {
          setShifts((prev) => prev.filter((s) => s.id !== tempId))
          toast.error("Failed to book shift")
        }
      } catch {
        setShifts((prev) => prev.filter((s) => s.id !== tempId))
        toast.error("Failed to book shift")
      }
    },
    [scheduleId, weekStart, orgId]
  )

  const handleSendRequest = async (deadline: string) => {
    setSending(true)
    try {
      const res = await fetch(`/api/orgs/${orgId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, deadline }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? "Failed to send availability request")
        return
      }
      const newReq: AvailabilityRequest = { ...json.data, submissions: [] }
      setAllRequests((prev) => [newReq, ...prev].sort((a, b) =>
        new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
      ))
      setRequest(newReq)
      setSendDialogOpen(false)
      toast.success("Availability request sent to all active employees")
    } catch {
      toast.error("Failed to send availability request")
    } finally {
      setSending(false)
    }
  }

  const deadline = request
    ? new Date(request.deadline).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Desktop header */}
      <div className="hidden md:flex items-center justify-between gap-3 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Availability</h1>
          {request && (
            <Badge
              variant="outline"
              className={request.status === "OPEN"
                ? "border-green-300 text-green-700 bg-green-50"
                : "text-gray-500"}
            >
              {request.status === "OPEN" ? "Open" : "Closed"}
            </Badge>
          )}
          {deadline && <p className="text-xs text-gray-500">· Deadline: {deadline}</p>}
        </div>
        <Button
          onClick={() => setSendDialogOpen(true)}
          disabled={sending || !!request}
          className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          size="sm"
        >
          <Send className="size-4" />
          {request ? "Request sent" : "Send Availability Request"}
        </Button>
      </div>
      {/* Mobile header */}
      <div className="md:hidden px-4 pt-6 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Availability</h1>
            {request && (
              <Badge
                variant="outline"
                className={request.status === "OPEN"
                  ? "border-green-300 text-green-700 bg-green-50"
                  : "text-gray-500"}
              >
                {request.status === "OPEN" ? "Open" : "Closed"}
              </Badge>
            )}
          </div>
          <Button
            onClick={() => setSendDialogOpen(true)}
            disabled={sending || !!request}
            className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
            size="sm"
          >
            <Send className="size-4" />
            {request ? "Request sent" : "Send"}
          </Button>
        </div>
        {deadline && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Deadline: {deadline}</p>}
      </div>

      <div className="flex-1 overflow-auto px-4 md:px-6 py-6 pb-20 md:pb-6">
      {/* Week navigation */}
      <div className="flex items-center gap-2 mb-5">
        <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => navigateWeek(-1)} aria-label="Previous week">
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 min-w-0">
          <span className="text-gray-400 dark:text-gray-500 mr-1.5 text-xs">Week {getISOWeek(weekStart)}</span>
          {formatWeekLabel(weekStart)}
        </div>
        <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => navigateWeek(1)} aria-label="Next week">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="grid grid-cols-[140px_repeat(7,1fr)] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="px-3 py-2"><Skeleton className="h-4 w-16" /></div>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="px-2 py-2 text-center border-l border-gray-200 dark:border-gray-700">
                <Skeleton className="h-3 w-8 mx-auto mb-1" />
                <Skeleton className="h-4 w-6 mx-auto" />
              </div>
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`grid grid-cols-[140px_repeat(7,1fr)] border-b border-gray-100 dark:border-gray-800 ${i % 2 === 1 ? "bg-gray-50/50 dark:bg-gray-800/50" : "bg-white dark:bg-gray-900"}`}>
              <div className="px-3 py-3 flex items-center gap-2">
                <Skeleton className="size-7 rounded-full shrink-0" />
                <Skeleton className="h-4 w-20" />
              </div>
              {Array.from({ length: 7 }).map((_, j) => (
                <div key={j} className="border-l border-gray-100 dark:border-gray-800 py-3 px-2">
                  <Skeleton className="h-6 w-full rounded-md" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : request ? (
        <AvailabilityGrid
          request={request}
          employees={employees}
          onBookShift={handleBookShift}
          shifts={shifts}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-20 text-center">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No availability request for this week</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Send a request to collect availability from your team.
          </p>
        </div>
      )}

      <AddShiftDialog
        open={bookDialog.open}
        onOpenChange={(open) => setBookDialog((p) => ({ ...p, open }))}
        employees={employees}
        jobRoles={jobRoles}
        shiftTemplates={shiftTemplates}
        defaultEmployeeId={bookDialog.employeeId}
        defaultDate={bookDialog.date}
        defaultStartTime={bookDialog.startTime}
        defaultEndTime={bookDialog.endTime}
        onShiftCreate={handleShiftCreate}
      />

      <SendAvailabilityDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        weekStart={weekStart}
        weekLabel={`Week ${getISOWeek(weekStart)} · ${formatWeekLabel(weekStart)}`}
        employeeCount={employees.filter((e) => e.isActive).length}
        sending={sending}
        onConfirm={handleSendRequest}
      />
      </div>
    </div>
  )
}
