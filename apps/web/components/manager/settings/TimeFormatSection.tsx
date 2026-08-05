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

export function TimeFormatSection() {
  const tToast = useTranslations("manager.toasts")
  const tSettings = useTranslations("manager.settings")
  const { orgId } = useOrg()
  const [timeFormat, setTimeFormat] = useState<TimeFormat>(() => getOrgSettings().timeFormat)

  const OPTIONS: { value: TimeFormat; label: string; example: string }[] = [
    { value: "24h", label: tSettings("timeFormat.opt24"), example: "14:00" },
    { value: "12h", label: tSettings("timeFormat.opt12"), example: "2:00 PM" },
  ]

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
      toast.success(tSettings("timeFormat.updated", {
        format: format === "24h" ? tSettings("timeFormat.opt24") : tSettings("timeFormat.opt12"),
      }))
    } catch {
      setTimeFormat(prev)
      updateOrgSettings({ timeFormat: prev })
      toast.error(tToast("timeFormatUpdateFailed"))
    }
  }

  return (
    <SettingsSection icon={Clock} title={tSettings("timeFormat.title")} description={tSettings("timeFormat.description")}>
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
        {tSettings("timeFormat.hint")}
      </p>
    </SettingsSection>
  )
}
