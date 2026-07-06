"use client"

import { useState } from "react"
import { ShieldAlert, LogOut } from "lucide-react"
import { useOrg } from "@/lib/orgContext"

/**
 * Persistent bar shown across the manager UI while a super admin is managing a
 * restaurant that isn't their own. Makes the "you are editing someone else's
 * data" state impossible to miss, with a one-click way back out.
 */
export function SuperAdminBanner() {
  const { acting, org } = useOrg()
  const [exiting, setExiting] = useState(false)

  if (!acting) return null

  const handleExit = async () => {
    setExiting(true)
    try {
      await fetch("/api/platform/act-as", { method: "DELETE" })
    } catch {
      // Even if the call fails, send them back to the overview — the cookie is
      // inert for non-super-admins, and they can retry from there.
    }
    // Full navigation so OrgProvider refetches context (back to their own org).
    window.location.href = "/platform"
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500 dark:bg-amber-600 px-4 py-1.5 text-amber-950 dark:text-amber-50">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="size-4 shrink-0" />
        <span className="text-xs font-semibold truncate">
          Super admin — managing <span className="font-bold">{org.name}</span>. Changes apply only to this restaurant.
        </span>
      </div>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="flex items-center gap-1.5 rounded-md bg-amber-950/15 hover:bg-amber-950/25 dark:bg-black/20 dark:hover:bg-black/30 px-2.5 py-1 text-xs font-semibold transition-colors shrink-0 disabled:opacity-60"
      >
        <LogOut className="size-3.5" />
        {exiting ? "Exiting…" : "Exit to platform"}
      </button>
    </div>
  )
}
