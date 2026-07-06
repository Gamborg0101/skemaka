"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface OrgRow {
  id: string
  name: string
  slug: string
  subscriptionStatus: string
  stripeCustomerId: string | null
  currency: string
  createdAt: string
  _count: {
    employees: number
    shifts: number
    memberships: number
    bugReports: number
  }
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  ACTIVE:   { label: "Active",    cls: "bg-green-100 text-green-700" },
  TRIALING: { label: "Trialing",  cls: "bg-yellow-100 text-yellow-700" },
  PAST_DUE: { label: "Past due",  cls: "bg-red-100 text-red-700" },
  CANCELED: { label: "Canceled",  cls: "bg-gray-100 text-gray-500" },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return "Today"
  if (d === 1) return "Yesterday"
  if (d < 30) return `${d}d ago`
  const m = Math.floor(d / 30)
  if (m < 12) return `${m}mo ago`
  return `${Math.floor(m / 12)}y ago`
}

export default function PlatformOrgsPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/platform/orgs")
      .then((r) => r.json())
      .then((d: { data?: OrgRow[] }) => { if (d.data) setOrgs(d.data) })
      .finally(() => setLoading(false))
  }, [])

  async function manage(orgId: string) {
    setOpening(orgId)
    try {
      const r = await fetch("/api/platform/act-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      })
      if (!r.ok) { setOpening(null); return }
      // Full navigation so the manager UI boots with the acting-org context.
      window.location.href = "/schedule"
    } catch {
      setOpening(null)
    }
  }

  const paying  = orgs.filter((o) => o.subscriptionStatus === "ACTIVE").length
  const trialing = orgs.filter((o) => o.subscriptionStatus === "TRIALING").length

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Organisations</h1>
        {!loading && (
          <p className="text-sm text-gray-500 mt-0.5">
            {orgs.length} total · {paying} paying · {trialing} trialing
          </p>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-12 ml-auto" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : orgs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-16">No organisations yet.</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Organisation</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Employees</th>
                <th className="px-4 py-3 text-right">Shifts</th>
                <th className="px-4 py-3 text-right">Managers</th>
                <th className="px-4 py-3 text-right">Errors</th>
                <th className="px-4 py-3 text-right">Joined</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org, i) => {
                const status = STATUS_STYLE[org.subscriptionStatus] ?? { label: org.subscriptionStatus, cls: "bg-gray-100 text-gray-500" }
                return (
                  <tr
                    key={org.id}
                    className={cn("border-b border-gray-100 last:border-0", i % 2 === 1 ? "bg-gray-50/50" : "bg-white")}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{org.name}</p>
                      <p className="text-xs text-gray-400">{org.slug} · {org.currency}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", status.cls)}>
                          {status.label}
                        </span>
                        {!org.stripeCustomerId && (
                          <span className="text-[10px] text-gray-400">no stripe</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{org._count.employees}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{org._count.shifts}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{org._count.memberships}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={org._count.bugReports > 0 ? "text-red-600 font-semibold" : "text-gray-400"}>
                        {org._count.bugReports}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">{timeAgo(org.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => manage(org.id)}
                        disabled={opening !== null}
                        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
                      >
                        {opening === org.id ? "Opening…" : "Manage"}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
