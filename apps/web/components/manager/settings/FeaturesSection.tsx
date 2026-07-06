"use client"

import { useState } from "react"
import { ToggleRight, CalendarX2, CalendarClock, CalendarPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { getOrgSettings, updateOrgSettings } from "@/lib/orgSettings"
import { toast } from "sonner"
import { useOrg } from "@/lib/orgContext"
import { SettingsSection } from "./SettingsSection"

const WINDOW_OPTIONS = [
  { value: 1, label: "1 week",  description: "Current week only" },
  { value: 2, label: "2 weeks", description: "Current + next week" },
  { value: 3, label: "3 weeks", description: "3 weeks ahead" },
  { value: 4, label: "4 weeks", description: "4 weeks ahead" },
]

export function FeaturesSection() {
  const { orgId, timeOffEnabled, setTimeOffEnabled, availabilityWindowWeeks, setAvailabilityWindowWeeks } = useOrg()
  const [includeManager, setIncludeManager] = useState(() => getOrgSettings().includeManagerInSchedule)
  const [savingManager, setSavingManager] = useState(false)

  async function handleToggleManager(enabled: boolean) {
    setIncludeManager(enabled)
    updateOrgSettings({ includeManagerInSchedule: enabled })
    setSavingManager(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeManagerInSchedule: enabled }),
      })
      if (!r.ok) throw new Error()
      toast.success(
        enabled
          ? "You're now on the schedule — reopen it to assign yourself shifts"
          : "You've been removed from the schedule",
      )
    } catch {
      setIncludeManager(!enabled)
      updateOrgSettings({ includeManagerInSchedule: !enabled })
      toast.error("Failed to update settings")
    } finally {
      setSavingManager(false)
    }
  }

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

  async function handleWindowChange(weeks: number) {
    const prev = availabilityWindowWeeks
    setAvailabilityWindowWeeks(weeks)
    try {
      const r = await fetch(`/api/orgs/${orgId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availabilityWindowWeeks: weeks }),
      })
      if (!r.ok) throw new Error()
      toast.success(`Employees can now submit availability up to ${weeks} week${weeks > 1 ? "s" : ""} ahead`)
    } catch {
      setAvailabilityWindowWeeks(prev)
      toast.error("Failed to update settings")
    }
  }

  return (
    <SettingsSection icon={ToggleRight} title="Features" description="Turn optional features on or off for your workspace.">
      <div className="mt-4 space-y-1">

        {/* Include manager in schedule */}
        <div className="flex items-center justify-between rounded-lg px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40">
          <div className="flex items-center gap-3">
            <CalendarPlus className="size-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Include me in the schedule</p>
              <p className="text-xs text-gray-500">
                Add yourself as a schedulable person so you can assign yourself shifts.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={includeManager}
            disabled={savingManager}
            onClick={() => handleToggleManager(!includeManager)}
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-60",
              includeManager ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
                includeManager ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {/* Time Off */}
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

        {/* Availability Window */}
        <div className="rounded-lg px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40">
          <div className="flex items-center gap-3 mb-3">
            <CalendarClock className="size-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Availability Window</p>
              <p className="text-xs text-gray-500">
                How far in advance employees can submit their availability.
              </p>
            </div>
          </div>
          <div className="flex gap-2 ml-7">
            {WINDOW_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleWindowChange(value)}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                  availabilityWindowWeeks === value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-transparent text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </SettingsSection>
  )
}
