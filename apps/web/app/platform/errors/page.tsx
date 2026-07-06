"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp, CheckCircle2, RotateCcw, Search, Trash2 } from "lucide-react"

type BugStatus = "OPEN" | "RESOLVED"

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
  status: BugStatus
  resolvedAt: string | null
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

/** Short human-friendly reference for "find this bug fast". */
function ref(id: string) {
  return id.slice(-6).toUpperCase()
}

function ReportCard({
  r,
  onSetStatus,
  onDelete,
}: {
  r: BugReportRow
  onSetStatus: (id: string, status: BugStatus) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isCrash = !!r.errorMessage
  const resolved = r.status === "RESOLVED"

  return (
    <div
      className={cn(
        "rounded-xl border bg-white shadow-sm overflow-hidden border-l-4",
        resolved ? "border-l-green-400 border-gray-200 opacity-75" : isCrash ? "border-l-red-400 border-gray-200" : "border-l-blue-400 border-gray-200"
      )}
    >
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-[10px] font-semibold text-gray-400">#{ref(r.id)}</span>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded",
                resolved ? "bg-green-100 text-green-700" : isCrash ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
              )}>
                {resolved ? "Resolved" : isCrash ? "Crash" : "Report"}
              </span>
              <span className="text-xs font-semibold text-gray-700">{r.orgName ?? "No restaurant"}</span>
              {r.userEmail && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-500">{r.userName ?? r.userEmail}</span>
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
            <p className="text-[10px] text-gray-300 mt-0.5">{new Date(r.createdAt).toLocaleDateString("en-GB")}</p>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-3 flex-wrap">
          {resolved ? (
            <button
              onClick={() => onSetStatus(r.id, "OPEN")}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
            >
              <RotateCcw className="size-3.5" /> Reopen
            </button>
          ) : (
            <button
              onClick={() => onSetStatus(r.id, "RESOLVED")}
              className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-800 transition-colors"
            >
              <CheckCircle2 className="size-3.5" /> Mark resolved
            </button>
          )}

          {(r.errorStack || r.component) && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              {expanded ? "Hide" : "Show"} details
            </button>
          )}

          <button
            onClick={() => onDelete(r.id)}
            className="flex items-center gap-1 text-xs text-gray-300 hover:text-red-500 transition-colors ml-auto"
          >
            <Trash2 className="size-3" /> Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
          {r.component && (
            <p className="text-xs text-gray-500"><span className="font-semibold text-gray-600">Component:</span> {r.component}</p>
          )}
          {r.url && (
            <p className="text-xs text-gray-500 break-all"><span className="font-semibold text-gray-600">URL:</span> {r.url}</p>
          )}
          {r.userEmail && (
            <p className="text-xs text-gray-500"><span className="font-semibold text-gray-600">Reporter:</span> {r.userName ? `${r.userName} · ` : ""}{r.userEmail}</p>
          )}
          {r.resolvedAt && (
            <p className="text-xs text-gray-500"><span className="font-semibold text-gray-600">Resolved:</span> {new Date(r.resolvedAt).toLocaleString("en-GB")}</p>
          )}
          {r.errorStack && (
            <pre className="text-[10px] leading-relaxed text-gray-600 bg-white border border-gray-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
              {r.errorStack}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function BugsInner() {
  const searchParams = useSearchParams()
  const [reports, setReports] = useState<BugReportRow[]>([])
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  const [orgFilter, setOrgFilter] = useState<string>(searchParams.get("org") ?? "")
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "RESOLVED" | "">(
    (searchParams.get("status") as "OPEN" | "RESOLVED") ?? "OPEN"
  )
  const [query, setQuery] = useState("")

  // Restaurant list for the filter dropdown.
  useEffect(() => {
    fetch("/api/platform/orgs")
      .then((r) => r.json())
      .then((d: { data?: { id: string; name: string }[] }) => { if (d.data) setOrgs(d.data) })
      .catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (orgFilter) params.set("organizationId", orgFilter)
    if (statusFilter) params.set("status", statusFilter)
    if (query.trim()) params.set("q", query.trim())
    fetch(`/api/platform/errors?${params}`)
      .then((r) => r.json())
      .then((d: { data?: BugReportRow[] }) => { if (d.data) setReports(d.data) })
      .finally(() => setLoading(false))
  }, [orgFilter, statusFilter, query])

  useEffect(() => {
    const t = setTimeout(load, 200) // debounce the search box
    return () => clearTimeout(t)
  }, [load])

  async function setStatus(id: string, status: BugStatus) {
    // Optimistic: drop it from the current view if it no longer matches the filter.
    setReports((prev) =>
      statusFilter && statusFilter !== status
        ? prev.filter((r) => r.id !== id)
        : prev.map((r) => (r.id === id ? { ...r, status } : r))
    )
    await fetch(`/api/platform/errors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => load())
  }

  async function deleteOne(id: string) {
    if (!confirm("Delete this bug report? This cannot be undone.")) return
    setReports((prev) => prev.filter((r) => r.id !== id))
    await fetch(`/api/platform/errors/${id}`, { method: "DELETE" }).catch(() => load())
  }

  const orgName = useMemo(() => orgs.find((o) => o.id === orgFilter)?.name, [orgs, orgFilter])

  return (
    <div className="px-6 py-6">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-gray-900">Bug reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {loading ? "Loading…" : `${reports.length} ${statusFilter === "OPEN" ? "open " : statusFilter === "RESOLVED" ? "resolved " : ""}report${reports.length === 1 ? "" : "s"}`}
          {orgName ? ` · ${orgName}` : ""}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* Status tabs */}
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          {([["OPEN", "Open"], ["RESOLVED", "Resolved"], ["", "All"]] as const).map(([val, label]) => (
            <button
              key={label}
              onClick={() => setStatusFilter(val)}
              className={cn(
                "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                statusFilter === val ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-800"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Restaurant filter */}
        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700"
        >
          <option value="">All restaurants</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search message, error, user…"
            className="w-full h-9 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400"
          />
        </div>
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
          <p className="text-base font-medium">
            {statusFilter === "OPEN" ? "No open bug reports" : "No bug reports"}
          </p>
          <p className="text-sm mt-1">
            {orgName ? `Nothing here for ${orgName}.` : "Reports from restaurants will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportCard key={r.id} r={r} onSetStatus={setStatus} onDelete={deleteOne} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function PlatformBugsPage() {
  return (
    <Suspense fallback={<div className="px-6 py-6 text-sm text-gray-400">Loading…</div>}>
      <BugsInner />
    </Suspense>
  )
}
