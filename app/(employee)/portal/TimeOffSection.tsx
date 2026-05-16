"use client"

import { useState, useEffect } from "react"
import { Plus, CalendarOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { TimeOffRequest } from "@/types"

const STATUS_STYLE: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  DENIED:   "bg-red-100 text-red-700",
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00Z")
  const e = new Date(end + "T00:00:00Z")
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" }
  if (start === end) return s.toLocaleDateString("en-GB", opts)
  return `${s.toLocaleDateString("en-GB", opts)} – ${e.toLocaleDateString("en-GB", { ...opts, year: "numeric" })}`
}

interface TimeOffSectionProps {
  orgId: string
}

export function TimeOffSection({ orgId }: TimeOffSectionProps) {
  const [requests, setRequests] = useState<TimeOffRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/time-off`)
      .then((r) => r.json())
      .then((d: { data?: TimeOffRequest[] }) => { if (d.data) setRequests(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orgId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate || !endDate) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/orgs/${orgId}/time-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, reason: reason.trim() || null }),
      })
      const data = await res.json() as { data?: TimeOffRequest; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Failed to submit request")
        return
      }
      setRequests((prev) => [data.data!, ...prev])
      setShowForm(false)
      setStartDate("")
      setEndDate("")
      setReason("")
      toast.success("Time off request submitted")
    } catch {
      toast.error("Failed to submit request")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2">
          <CalendarOff className="size-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-800">Time Off</h2>
        </div>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="size-3.5 mr-1" />
            Request
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="px-4 py-4 border-b border-gray-100 space-y-3 bg-gray-50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (endDate && e.target.value > endDate) setEndDate(e.target.value)
                }}
                className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Reason (optional)</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. holiday, appointment…"
              className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="size-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </div>
      ) : requests.length === 0 && !showForm ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-gray-400">No time off requests yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {requests.map((r) => (
            <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {formatDateRange(r.startDate, r.endDate)}
                </p>
                {r.reason && <p className="text-xs text-gray-500 mt-0.5">{r.reason}</p>}
                {r.reviewNote && (
                  <p className="text-xs text-gray-400 mt-0.5 italic">Note: {r.reviewNote}</p>
                )}
              </div>
              <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>
                {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
