"use client"

import { useState, useEffect, useCallback } from "react"
import { Send, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AvailabilityGrid } from "@/components/manager/AvailabilityGrid"
import { AddShiftDialog } from "@/components/manager/AddShiftDialog"
import { toast } from "sonner"
import { useOrg } from "@/lib/orgContext"
import { getMondayOfWeek, addDays, getISOWeek, formatWeekLabel } from "@/lib/dateUtils"
import type { AvailabilityRequest, Employee, Shift, Schedule } from "@/types"

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

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [bookDialog, setBookDialog] = useState<{
    open: boolean; employeeId: string; date: string; startTime: string; endTime: string
  }>({ open: false, employeeId: "", date: "", startTime: "09:00", endTime: "17:00" })

  // Load employees + all requests once
  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    Promise.all([
      fetch(`/api/orgs/${orgId}/employees`).then((r) => r.json()),
      fetch(`/api/orgs/${orgId}/availability`).then((r) => r.json()),
    ]).then(([empRes, reqRes]) => {
      if (empRes.data) setEmployees(empRes.data)
      const reqs: AvailabilityRequest[] = reqRes.data ?? []
      setAllRequests(reqs)

      // Jump to the most recent request's week if one exists
      if (reqs[0]?.weekStart) setWeekStart(reqs[0].weekStart)

      setLoading(false)
    }).catch(() => setLoading(false))
  }, [orgId])

  // Whenever the week changes, load the matching request + schedule
  useEffect(() => {
    if (!orgId || loading) return
    let cancelled = false

    const matched = allRequests.find((r) => r.weekStart === weekStart) ?? null

    async function load() {
      // Fetch request submissions (if a request exists for this week)
      let fullRequest: AvailabilityRequest | null = matched
      if (matched) {
        try {
          const subRes = await fetch(`/api/orgs/${orgId}/availability/${matched.id}/submissions`)
          const subJson = await subRes.json()
          if (!cancelled) fullRequest = { ...matched, submissions: subJson.data ?? [] }
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
  }, [orgId, weekStart, loading]) // eslint-disable-line react-hooks/exhaustive-deps

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
        ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
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

  const handleSendRequest = async () => {
    setSending(true)
    const deadlineDate = new Date()
    deadlineDate.setHours(23, 59, 59, 0)
    const deadline = deadlineDate.toISOString()

    try {
      const res = await fetch(`/api/orgs/${orgId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, deadline }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const newReq: AvailabilityRequest = { ...json.data, submissions: [] }
      setAllRequests((prev) => [newReq, ...prev].sort((a, b) =>
        new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
      ))
      setRequest(newReq)
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
    <div className="px-4 md:px-6 py-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-semibold text-gray-900">Availability</h1>
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
          <p className="text-sm text-gray-500">
            {deadline ? `Deadline: ${deadline}` : "No request sent for this week."}
          </p>
        </div>
        <Button
          onClick={handleSendRequest}
          disabled={sending || !!request}
          className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          size="sm"
        >
          <Send className="size-4" />
          {sending ? "Sending..." : request ? "Request sent" : "Send Availability Request"}
        </Button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-2 mb-5">
        <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => navigateWeek(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-sm font-medium text-gray-800 min-w-0">
          <span className="text-gray-400 mr-1.5 text-xs">Week {getISOWeek(weekStart)}</span>
          {formatWeekLabel(weekStart)}
        </div>
        <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => navigateWeek(1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white py-20 text-center">
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      ) : request ? (
        <AvailabilityGrid
          request={request}
          employees={employees}
          onBookShift={handleBookShift}
          shifts={shifts}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
          <p className="text-sm font-medium text-gray-500">No availability request for this week</p>
          <p className="text-xs text-gray-400 mt-1">
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
    </div>
  )
}
