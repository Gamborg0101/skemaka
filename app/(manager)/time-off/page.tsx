"use client"

import { useState, useEffect } from "react"
import { Check, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useOrg } from "@/lib/orgContext"
import type { TimeOffRequest } from "@/types"
import { cn } from "@/lib/utils"

type Tab = "PENDING" | "APPROVED" | "DENIED"

const STATUS_STYLE: Record<Tab, string> = {
  PENDING:  "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  DENIED:   "bg-red-100 text-red-700",
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00Z")
  const e = new Date(end + "T00:00:00Z")
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
  if (start === end) return s.toLocaleDateString("en-GB", opts)
  return `${s.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} – ${e.toLocaleDateString("en-GB", opts)}`
}

export default function TimeOffPage() {
  const { orgId } = useOrg()
  const [tab, setTab] = useState<Tab>("PENDING")
  const [requests, setRequests] = useState<TimeOffRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [denyId, setDenyId] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/orgs/${orgId}/time-off`)
      .then((r) => r.json())
      .then((d: { data?: TimeOffRequest[] }) => {
        if (!cancelled && d.data) setRequests(d.data)
      })
      .catch(() => { if (!cancelled) toast.error("Failed to load requests") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orgId])

  const tabs: Tab[] = ["PENDING", "APPROVED", "DENIED"]
  const filtered = requests.filter((r) => r.status === tab)

  async function handleApprove(id: string) {
    setActing(id)
    try {
      const res = await fetch(`/api/orgs/${orgId}/time-off/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      })
      if (!res.ok) { toast.error("Failed to approve"); return }
      const data = await res.json() as { data: TimeOffRequest }
      setRequests((prev) => prev.map((r) => (r.id === id ? data.data : r)))
      toast.success("Request approved")
    } finally {
      setActing(null)
    }
  }

  async function handleDeny(id: string) {
    if (denyId !== id) { setDenyId(id); setReviewNote(""); return }
    setActing(id)
    try {
      const res = await fetch(`/api/orgs/${orgId}/time-off/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DENIED", reviewNote: reviewNote.trim() || undefined }),
      })
      if (!res.ok) { toast.error("Failed to deny"); return }
      const data = await res.json() as { data: TimeOffRequest }
      setRequests((prev) => prev.map((r) => (r.id === id ? data.data : r)))
      setDenyId(null)
      toast.success("Request denied")
    } finally {
      setActing(null)
    }
  }

  async function handleDelete(id: string) {
    setActing(id)
    try {
      const res = await fetch(`/api/orgs/${orgId}/time-off/${id}`, { method: "DELETE" })
      if (!res.ok) { toast.error("Failed to delete"); return }
      setRequests((prev) => prev.filter((r) => r.id !== id))
      toast.success("Request deleted")
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="px-4 md:px-6 py-6 pb-20 md:pb-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Time Off</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
            <span className={cn(
              "text-xs px-1.5 py-px rounded-full font-semibold",
              tab === t ? "bg-gray-100 text-gray-600" : "bg-gray-200 text-gray-500"
            )}>
              {requests.filter((r) => r.status === t).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="size-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base font-medium">No {tab.toLowerCase()} requests</p>
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {filtered.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{r.employee?.name}</p>
                    <span className="text-xs text-gray-400">·</span>
                    <p className="text-xs text-gray-500">{r.employee?.jobRole}</p>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{formatDateRange(r.startDate, r.endDate)}</p>
                  {r.reason && <p className="text-xs text-gray-500 mt-1">{r.reason}</p>}
                  {r.reviewNote && <p className="text-xs text-gray-400 mt-1 italic">Note: {r.reviewNote}</p>}
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
                    className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="destructive" disabled={!!acting} onClick={() => handleDeny(r.id)}>
                      Confirm
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDenyId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                {tab === "PENDING" && (
                  <>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      disabled={!!acting}
                      onClick={() => handleApprove(r.id)}
                    >
                      <Check className="size-3.5 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      disabled={!!acting}
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
                    className="text-gray-400 hover:text-red-500"
                    disabled={!!acting}
                    onClick={() => handleDelete(r.id)}
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
