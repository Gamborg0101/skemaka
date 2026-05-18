"use client"

import { useState } from "react"
import { CalendarDays, LayoutGrid, AlignLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { getOrgSettings, updateOrgSettings } from "@/lib/orgSettings"
import { toast } from "sonner"
import { useOrg } from "@/lib/orgContext"
import { SettingsSection } from "./SettingsSection"

export function ScheduleViewSection() {
  const { orgId } = useOrg()
  const [defaultScheduleView, setDefaultScheduleView] = useState<"week" | "timeline">(
    () => getOrgSettings().defaultScheduleView
  )

  async function handleSetDefaultView(view: "week" | "timeline") {
    const prev = defaultScheduleView
    setDefaultScheduleView(view)
    updateOrgSettings({ defaultScheduleView: view })
    try {
      const r = await fetch(`/api/orgs/${orgId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultScheduleView: view }),
      })
      if (!r.ok) throw new Error()
      toast.success(`Default schedule view set to ${view === "week" ? "Week" : "Timeline"}`)
    } catch {
      setDefaultScheduleView(prev)
      updateOrgSettings({ defaultScheduleView: prev })
      toast.error("Failed to update schedule view")
    }
  }

  return (
    <SettingsSection icon={CalendarDays} title="Schedule View" description="Default view when opening the schedule.">
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleSetDefaultView("week")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
            defaultScheduleView === "week"
              ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:text-gray-200"
          )}
        >
          <LayoutGrid className="size-4" />
          Week
        </button>
        <button
          type="button"
          onClick={() => handleSetDefaultView("timeline")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
            defaultScheduleView === "timeline"
              ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:text-gray-200"
          )}
        >
          <AlignLeft className="size-4" />
          Timeline
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        You can still switch views on the schedule page at any time.
      </p>
    </SettingsSection>
  )
}
