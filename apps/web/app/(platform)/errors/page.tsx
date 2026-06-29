"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"

interface BugReportRow {
  id: string
  organizationId: string | null
  userId: string | null
  orgName: string | null
  userName: string | null
  userEmail: string | null
  message: string | null
  errorMessage: string | null
  errorStack: string | null
  url: string | null
  component: string | null
  createdAt: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return "Just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function ReportCard({ r }: { r: BugReportRow }) {
  const [expanded, setExpanded] = useState(false)
  const isCrash = !!r.errorMessage

  return (
    <div className={cn(
      "rounded-xl border bg-white shadow-sm overflow-hidden",
      isCrash ? "border-l-4 border-l-red-400 border-gray-200" : "border-l-4 border-l-blue-400 border-gray-200"
    )}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded",
                isCrash ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
              )}>
                {isCrash ? "Crash" : "Report"}
              </span>
              {r.orgName && (
                <span className="text-xs font-semibold text-gray-700">{r.orgName}</span>
              )}
              {!r.orgName && (
                <span className="text-xs text-gray-400">No org</span>
              )}
              {r.userEmail && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-500">{r.userName ?? r.userEmail}</span>
                  <span className="text-xs text-gray-400">{r.userEmail}</span>
                </>
              )}
            </div>

            {r.errorMessage && (
              <p className="text-sm font-medium text-red-700 mb-1 break-all">{r.errorMessage}</p>
            )}
            {r.message && (
              <p className="text-sm text-gray-700 italic">&ldquo;{r.message}&rdquo;</p>
            )}
            {r.url && (
              <p className="text-xs text-gray-400 mt-1 truncate">{r.url}</p>
            )}
          </div>

          <div className="shrink-0 text-right">
            <p className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(r.createdAt)}</p>
            <p className="text-[10px] text-gray-300 mt-0.5">
              {new Date(r.createdAt).toLocaleDateString("en-GB")}
            </p>
          </div>
        </div>

        {r.errorStack && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {expanded ? "Hide" : "Show"} stack trace
          </button>
        )}
      </div>

      {expanded && r.errorStack && (
        <pre className="px-4 pb-4 text-[10px] leading-relaxed text-gray-600 bg-gray-50 border-t border-gray-100 overflow-x-auto whitespace-pre-wrap break-all">
          {r.errorStack}
        </pre>
      )}
    </div>
  )
}

export default function PlatformErrorsPage() {
  const [reports, setReports] = useState<BugReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    fetch("/api/platform/errors")
      .then((r) => r.json())
      .then((d: { data?: BugReportRow[] }) => { if (d.data) setReports(d.data) })
      .finally(() => setLoading(false))
  }, [])

  const crashes = reports.filter((r) => !!r.errorMessage).length
  const manual  = reports.filter((r) => !r.errorMessage).length

  async function handleClearAll() {
    if (!confirm("Delete all error reports? This cannot be undone.")) return
    setClearing(true)
    await fetch("/api/platform/errors", { method: "DELETE" })
    setReports([])
    setClearing(false)
  }

  return (
    <div className="px-6 py-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Error log</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-0.5">
              {reports.length} total · {crashes} crashes · {manual} manual reports
            </p>
          )}
        </div>
        {reports.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-red-500"
            disabled={clearing}
            onClick={handleClearAll}
          >
            <Trash2 className="size-3.5 mr-1.5" />
            Clear all
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex gap-3 mb-2">
                <Skeleton className="h-4 w-12 rounded" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-base font-medium">No errors reported</p>
          <p className="text-sm mt-1">Bug reports from users will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => <ReportCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  )
}
