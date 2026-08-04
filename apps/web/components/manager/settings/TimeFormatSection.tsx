"use client"

import { useState } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { getOrgSettings, updateOrgSettings } from "@/lib/orgSettings"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { useOrg } from "@/lib/orgContext"
import { SettingsSection } from "./SettingsSection"

type TimeFormat = "12h" | "24h"

const OPTIONS: { value: TimeFormat; label: string; example: string }[] = [
  { value: "24h", label: "24-hour", example: "14:00" },
  { value: "12h", label: "12-hour", example: "2:00 PM" },
]

export function TimeFormatSection() {
  const tToast = useTranslations("manager.toasts")
  const { orgId } = useOrg()
  const [timeFormat, setTimeFormat] = useState<TimeFormat>(() => getOrgSettings().timeFormat)

  async function handleSet(format: TimeFormat) {
    if (format === timeFormat) return
    const prev = timeFormat
    setTimeFormat(format)
    updateOrgSettings({ timeFormat: format })
    try {
      const r = await fetch(`/api/orgs/${orgId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeFormat: format }),
      })
      if (!r.ok) throw new Error()
      toast.success(`Times now shown in ${format === "24h" ? "24-hour" : "12-hour"} format`)
    } catch {
      setTimeFormat(prev)
      updateOrgSettings({ timeFormat: prev })
      toast.error(tToast("timeFormatUpdateFailed"))
    }
  }

  return (
    <SettingsSection icon={Clock} title="Time Format" description="How shift times are displayed across the app.">
      <div className="mt-4 flex items-center gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSet(opt.value)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
              timeFormat === opt.value
                ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:text-gray-200"
            )}
          >
            <Clock className="size-4" />
            {opt.label}
            <span className="text-xs opacity-60 tabular-nums">{opt.example}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3">
        24-hour is standard across Europe; 12-hour (AM/PM) is common in the US.
      </p>
    </SettingsSection>
  )
}
