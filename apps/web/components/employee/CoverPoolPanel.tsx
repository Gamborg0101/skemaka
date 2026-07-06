"use client"

import { useState, useEffect, useCallback } from "react"
import { HandHelping } from "lucide-react"
import { toast } from "sonner"
import { formatTime } from "@/lib/dateUtils"
import { getOrgSettings } from "@/lib/orgSettings"
import type { CoverRequest } from "@/types"

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  })
}

/**
 * Open shifts a teammate has offered up that the current user could claim.
 * Renders nothing when the pool is empty. Manager approval still applies after a
 * claim, so claiming just puts the user forward.
 */
export function CoverPoolPanel({ orgId }: { orgId: string }) {
  const [pool, setPool] = useState<CoverRequest[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/orgs/${orgId}/cover-requests`, { cache: "no-store" })
      if (!r.ok) return
      const res = (await r.json()) as { data?: { pool?: CoverRequest[] } }
      setPool(res.data?.pool ?? [])
    } catch {
      /* silent */
    } finally {
      setLoaded(true)
    }
  }, [orgId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
  useEffect(() => { load() }, [load])

  async function claim(id: string) {
    setBusyId(id)
    try {
      const r = await fetch(`/api/orgs/${orgId}/cover-requests/${id}/claim`, { method: "POST" })
      const res = (await r.json()) as { error?: string }
      if (!r.ok) throw new Error(res.error ?? "Couldn't claim this shift")
      toast.success("You offered to cover — your manager will confirm it")
      setPool((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusyId(null)
    }
  }

  if (!loaded || pool.length === 0) return null

  const tf = getOrgSettings().timeFormat

  return (
    <div className="mb-5 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-blue-200/70 dark:border-blue-900/40">
        <HandHelping className="size-4 text-blue-600 dark:text-blue-400" />
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Shifts you can cover</p>
      </div>
      <ul className="divide-y divide-blue-200/50 dark:divide-blue-900/30">
        {pool.map((req) => (
          <li key={req.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 text-sm">
              <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {req.shift.jobRole} · {formatDate(req.shift.date)}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {formatTime(req.shift.startTime, tf)}–{formatTime(req.shift.endTime, tf)} · offered by {req.requesterName}
              </p>
              {req.note && <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 italic">&ldquo;{req.note}&rdquo;</p>}
            </div>
            <button
              type="button"
              disabled={busyId === req.id}
              onClick={() => claim(req.id)}
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {busyId === req.id ? "Claiming…" : "I'll cover it"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
