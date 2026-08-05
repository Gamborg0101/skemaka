"use client"

import { useState } from "react"
import { ToggleRight, CalendarX2, CalendarClock, CalendarPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { getOrgSettings, updateOrgSettings } from "@/lib/orgSettings"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { useOrg } from "@/lib/orgContext"
import { SettingsSection } from "./SettingsSection"

const WINDOW_VALUES = [1, 2, 3, 4]

export function FeaturesSection() {
  const tToast = useTranslations("manager.toasts")
  const tSettings = useTranslations("manager.settings")
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
          ? tSettings("features.includeMeEnabled")
          : tSettings("features.includeMeDisabled"),
      )
    } catch {
      setIncludeManager(!enabled)
      updateOrgSettings({ includeManagerInSchedule: !enabled })
      toast.error(tToast("settingsUpdateFailed"))
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
      toast.success(enabled ? tSettings("features.timeOffEnabled") : tSettings("features.timeOffDisabled"))
    } catch {
      setTimeOffEnabled(!enabled)
      updateOrgSettings({ timeOffEnabled: !enabled })
      toast.error(tToast("settingsUpdateFailed"))
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
      toast.success(tSettings("features.availabilityWindowUpdated", { weeks }))
    } catch {
      setAvailabilityWindowWeeks(prev)
      toast.error(tToast("settingsUpdateFailed"))
    }
  }

  return (
    <SettingsSection icon={ToggleRight} title={tSettings("features.title")} description={tSettings("features.description")}>
      <div className="mt-4 space-y-1">

        {/* Include manager in schedule */}
        <div className="flex items-center justify-between rounded-lg px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40">
          <div className="flex items-center gap-3">
            <CalendarPlus className="size-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{tSettings("features.includeMe")}</p>
              <p className="text-xs text-gray-500">
                {tSettings("features.includeMeDesc")}
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
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{tSettings("features.timeOffTitle")}</p>
              <p className="text-xs text-gray-500">
                {tSettings("features.timeOffDesc")}
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
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{tSettings("features.availabilityWindowTitle")}</p>
              <p className="text-xs text-gray-500">
                {tSettings("features.availabilityWindowDesc")}
              </p>
            </div>
          </div>
          <div className="flex gap-2 ml-7">
            {WINDOW_VALUES.map((value) => (
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
                {tSettings("features.weeksOption", { n: value })}
              </button>
            ))}
          </div>
        </div>

      </div>
    </SettingsSection>
  )
}
