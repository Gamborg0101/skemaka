"use client"

import { useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AvailabilityGrid } from "@/components/manager/AvailabilityGrid"
import { AddShiftDialog } from "@/components/manager/AddShiftDialog"
import { toast } from "sonner"
import type { AvailabilityRequest } from "@/types"
import { MOCK_JOB_ROLES } from "@/lib/mockData"
import { getEmployees } from "@/lib/employeeStore"

// ── Mock data ─────────────────────────────────────────────────────────────────
// TODO: fetch from /api/organizations/[orgId]/availability-requests?latest=true
// TODO: fetch from /api/organizations/[orgId]/employees


const MOCK_REQUEST: AvailabilityRequest = {
  id: "req-1",
  organizationId: "org-1",
  weekStart: "2026-05-18",
  deadline: "2026-05-15T23:59:59Z",
  status: "OPEN",
  createdAt: "2026-05-12T10:00:00Z",
  submissions: [
    {
      id: "sub-1",
      requestId: "req-1",
      employeeId: "emp-1",
      organizationId: "org-1",
      submittedAt: "2026-05-13T09:00:00Z",
      days: [
        { id: "d-1", submissionId: "sub-1", date: "2026-05-18", isAvailable: true, preferredStart: "08:00", preferredEnd: "16:00" },
        { id: "d-2", submissionId: "sub-1", date: "2026-05-19", isAvailable: true, preferredStart: "08:00", preferredEnd: "16:00" },
        { id: "d-3", submissionId: "sub-1", date: "2026-05-20", isAvailable: false, preferredStart: null, preferredEnd: null },
        { id: "d-4", submissionId: "sub-1", date: "2026-05-21", isAvailable: true, preferredStart: null, preferredEnd: null },
        { id: "d-5", submissionId: "sub-1", date: "2026-05-22", isAvailable: true, preferredStart: "09:00", preferredEnd: "15:00" },
        { id: "d-6", submissionId: "sub-1", date: "2026-05-23", isAvailable: false, preferredStart: null, preferredEnd: null },
        { id: "d-7", submissionId: "sub-1", date: "2026-05-24", isAvailable: false, preferredStart: null, preferredEnd: null },
      ],
    },
    {
      id: "sub-2",
      requestId: "req-1",
      employeeId: "emp-2",
      organizationId: "org-1",
      submittedAt: "2026-05-13T14:30:00Z",
      days: [
        { id: "d-8", submissionId: "sub-2", date: "2026-05-18", isAvailable: false, preferredStart: null, preferredEnd: null },
        { id: "d-9", submissionId: "sub-2", date: "2026-05-19", isAvailable: true, preferredStart: "10:00", preferredEnd: "18:00" },
        { id: "d-10", submissionId: "sub-2", date: "2026-05-20", isAvailable: true, preferredStart: "10:00", preferredEnd: "18:00" },
        { id: "d-11", submissionId: "sub-2", date: "2026-05-21", isAvailable: true, preferredStart: "10:00", preferredEnd: "18:00" },
        { id: "d-12", submissionId: "sub-2", date: "2026-05-22", isAvailable: true, preferredStart: "10:00", preferredEnd: "18:00" },
        { id: "d-13", submissionId: "sub-2", date: "2026-05-23", isAvailable: true, preferredStart: "10:00", preferredEnd: "18:00" },
        { id: "d-14", submissionId: "sub-2", date: "2026-05-24", isAvailable: false, preferredStart: null, preferredEnd: null },
      ],
    },
    {
      id: "sub-3",
      requestId: "req-1",
      employeeId: "emp-4",
      organizationId: "org-1",
      submittedAt: "2026-05-14T08:15:00Z",
      days: [
        { id: "d-15", submissionId: "sub-3", date: "2026-05-18", isAvailable: true, preferredStart: "12:00", preferredEnd: "20:00" },
        { id: "d-16", submissionId: "sub-3", date: "2026-05-19", isAvailable: true, preferredStart: "12:00", preferredEnd: "20:00" },
        { id: "d-17", submissionId: "sub-3", date: "2026-05-20", isAvailable: true, preferredStart: "12:00", preferredEnd: "20:00" },
        { id: "d-18", submissionId: "sub-3", date: "2026-05-21", isAvailable: false, preferredStart: null, preferredEnd: null },
        { id: "d-19", submissionId: "sub-3", date: "2026-05-22", isAvailable: false, preferredStart: null, preferredEnd: null },
        { id: "d-20", submissionId: "sub-3", date: "2026-05-23", isAvailable: true, preferredStart: null, preferredEnd: null },
        { id: "d-21", submissionId: "sub-3", date: "2026-05-24", isAvailable: true, preferredStart: null, preferredEnd: null },
      ],
    },
    {
      id: "sub-4",
      requestId: "req-1",
      employeeId: "emp-5",
      organizationId: "org-1",
      submittedAt: "2026-05-14T11:00:00Z",
      days: [
        { id: "d-22", submissionId: "sub-4", date: "2026-05-18", isAvailable: true, preferredStart: "09:00", preferredEnd: "17:00" },
        { id: "d-23", submissionId: "sub-4", date: "2026-05-19", isAvailable: true, preferredStart: "09:00", preferredEnd: "17:00" },
        { id: "d-24", submissionId: "sub-4", date: "2026-05-20", isAvailable: true, preferredStart: "09:00", preferredEnd: "17:00" },
        { id: "d-25", submissionId: "sub-4", date: "2026-05-21", isAvailable: true, preferredStart: "09:00", preferredEnd: "17:00" },
        { id: "d-26", submissionId: "sub-4", date: "2026-05-22", isAvailable: true, preferredStart: "09:00", preferredEnd: "17:00" },
        { id: "d-27", submissionId: "sub-4", date: "2026-05-23", isAvailable: false, preferredStart: null, preferredEnd: null },
        { id: "d-28", submissionId: "sub-4", date: "2026-05-24", isAvailable: false, preferredStart: null, preferredEnd: null },
      ],
    },
  ],
}

export default function AvailabilityPage() {
  const [request, setRequest] = useState<AvailabilityRequest | null>(MOCK_REQUEST)
  const [sending, setSending] = useState(false)
  const [bookDialog, setBookDialog] = useState<{
    open: boolean
    employeeId: string
    date: string
    startTime: string
    endTime: string
  }>({ open: false, employeeId: "", date: "", startTime: "09:00", endTime: "17:00" })
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set())

  const handleBookShift = (employeeId: string, date: string, startTime: string | null, endTime: string | null) => {
    setBookDialog({
      open: true,
      employeeId,
      date,
      startTime: startTime ?? "09:00",
      endTime: endTime ?? "17:00",
    })
  }

  const handleShiftCreated = () => {
    setBookedSlots((prev) => new Set([...prev, `${bookDialog.employeeId}:${bookDialog.date}`]))
    toast.success("Shift created")
  }

  const handleSendRequest = async () => {
    // TODO: POST /api/organizations/[orgId]/availability-requests
    setSending(true)
    await new Promise((r) => setTimeout(r, 1000)) // simulate network
    setSending(false)
    toast.success("Availability request sent to all active employees")
  }

  const weekLabel = request
    ? new Date(request.weekStart).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

  const deadline = request
    ? new Date(request.deadline).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
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
                className={
                  request.status === "OPEN"
                    ? "border-green-300 text-green-700 bg-green-50"
                    : "text-gray-500"
                }
              >
                {request.status === "OPEN" ? "Open" : "Closed"}
              </Badge>
            )}
          </div>
          {request ? (
            <p className="text-sm text-gray-500">
              Week of {weekLabel} &middot; Deadline: {deadline}
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              No availability request has been sent yet.
            </p>
          )}
        </div>
        <Button
          onClick={handleSendRequest}
          disabled={sending}
          className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          size="sm"
        >
          <Send className="size-4" />
          {sending ? "Sending..." : "Send Availability Request"}
        </Button>
      </div>

      {request ? (
        <AvailabilityGrid request={request} employees={getEmployees()} onBookShift={handleBookShift} bookedSlots={bookedSlots} />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
          <p className="text-sm font-medium text-gray-500">No submissions yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Send an availability request to collect responses from your team.
          </p>
        </div>
      )}

      <AddShiftDialog
        open={bookDialog.open}
        onOpenChange={(open) => setBookDialog((p) => ({ ...p, open }))}
        employees={getEmployees()}
        jobRoles={MOCK_JOB_ROLES}
        defaultEmployeeId={bookDialog.employeeId}
        defaultDate={bookDialog.date}
        defaultStartTime={bookDialog.startTime}
        defaultEndTime={bookDialog.endTime}
        onShiftCreate={handleShiftCreated}
      />
    </div>
  )
}
