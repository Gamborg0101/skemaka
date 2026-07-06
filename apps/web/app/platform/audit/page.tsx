"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface AuditRow {
  id: string
  actorEmail: string
  organizationId: string | null
  orgName: string | null
  action: string
  method: string | null
  path: string | null
  createdAt: string
}

const ACTION_STYLE: Record<string, string> = {
  ENTER:  "bg-amber-100 text-amber-700",
  EXIT:   "bg-gray-100 text-gray-600",
  MUTATE: "bg-blue-100 text-blue-700",
}

function when(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  })
}

export default function PlatformAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/platform/audit")
      .then((r) => r.json())
      .then((d: { data?: AuditRow[] }) => { if (d.data) setRows(d.data) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Audit log</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Super-admin activity across restaurants. Newest first.
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-48 ml-auto" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-16">No super-admin activity recorded yet.</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Restaurant</th>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Actor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  className={cn("border-b border-gray-100 last:border-0", i % 2 === 1 ? "bg-gray-50/50" : "bg-white")}
                >
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{when(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", ACTION_STYLE[r.action] ?? "bg-gray-100 text-gray-500")}>
                      {r.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{r.orgName ?? r.organizationId ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                    {r.method || r.path ? `${r.method ?? ""} ${r.path ?? ""}`.trim() : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.actorEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
