"use client"

import { useState } from "react"
import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TimePicker } from "@/components/manager/TimePicker"
import { cn } from "@/lib/utils"
import { getOrgSettings, updateOrgSettings } from "@/lib/orgSettings"
import type { DayHours } from "@/lib/orgSettings"
import { toast } from "sonner"
import { useOrg } from "@/lib/orgContext"
import { SettingsSection } from "./SettingsSection"

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export function StoreHoursSection() {
  const { orgId } = useOrg()
  const [hours, setHours] = useState<DayHours[]>(() => getOrgSettings().hours)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  function updateDay(i: number, patch: Partial<DayHours>) {
    setHours((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], ...patch }
      return next
    })
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }),
      })
      if (!r.ok) throw new Error()
      updateOrgSettings({ hours })
      setDirty(false)
      toast.success("Store hours saved")
    } catch {
      toast.error("Failed to save store hours")
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection icon={Clock} title="Store Hours" description="Opening and closing times per day.">
      <div className="space-y-1 mt-4">
        {DAY_NAMES.map((name, i) => {
          const day = hours[i]
          return (
            <div
              key={name}
              className={cn("flex items-center gap-3 rounded-lg px-3 py-2", !day.isOpen && "opacity-60")}
            >
              <span className="w-24 text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">{name}</span>
              {day.isOpen ? (
                <div className="flex items-center gap-2 flex-1">
                  <TimePicker value={day.openTime} onChange={(v) => updateDay(i, { openTime: v })} />
                  <span className="text-gray-400 text-sm">–</span>
                  <TimePicker value={day.closeTime} onChange={(v) => updateDay(i, { closeTime: v })} />
                </div>
              ) : (
                <span className="flex-1 text-sm text-gray-400 dark:text-gray-500">Closed</span>
              )}
              <button
                type="button"
                onClick={() => updateDay(i, { isOpen: !day.isOpen })}
                className={cn(
                  "ml-auto shrink-0 text-xs font-medium px-2.5 py-1 rounded-full transition-colors",
                  day.isOpen
                    ? "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50"
                    : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60"
                )}
              >
                {day.isOpen ? "Set closed" : "Set open"}
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between gap-4">
        <p className="text-xs text-gray-400">
          The timeline shows each day&apos;s hours with a 2-hour buffer on each end.
        </p>
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 shrink-0"
          size="sm"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </SettingsSection>
  )
}
