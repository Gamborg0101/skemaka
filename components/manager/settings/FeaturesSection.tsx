"use client"

import { ToggleRight, CalendarX2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { updateOrgSettings } from "@/lib/orgSettings"
import { toast } from "sonner"
import { useOrg } from "@/lib/orgContext"
import { SettingsSection } from "./SettingsSection"

export function FeaturesSection() {
  const { orgId, timeOffEnabled, setTimeOffEnabled } = useOrg()

  async function handleToggleTimeOff(enabled: boolean) {
    setTimeOffEnabled(enabled)
    updateOrgSettings({ timeOffEnabled: enabled })
    try {
      const r = await fetch(`/api/orgs/${orgId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeOffEnabled: enabled }),
      })
      if (!r.ok) throw new Error()
      toast.success(enabled ? "Time off requests enabled" : "Time off requests disabled")
    } catch {
      setTimeOffEnabled(!enabled)
      updateOrgSettings({ timeOffEnabled: !enabled })
      toast.error("Failed to update settings")
    }
  }

  return (
    <SettingsSection icon={ToggleRight} title="Features" description="Turn optional features on or off for your workspace.">
      <div className="mt-4 space-y-1">
        <div className="flex items-center justify-between rounded-lg px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40">
          <div className="flex items-center gap-3">
            <CalendarX2 className="size-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Time Off Requests</p>
              <p className="text-xs text-gray-500">
                Let employees submit time off requests for you to approve or deny.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={timeOffEnabled}
            onClick={() => handleToggleTimeOff(!timeOffEnabled)}
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500",
              timeOffEnabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
                timeOffEnabled ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </div>
    </SettingsSection>
  )
}
