"use client"

import { useState } from "react"
import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TimePicker } from "@/components/manager/TimePicker"
import { cn } from "@/lib/utils"
import { getOrgSettings, updateOrgSettings, MIN_TIMELINE_BUFFER_HOURS, MAX_TIMELINE_BUFFER_HOURS } from "@/lib/orgSettings"
import type { DayHours } from "@/lib/orgSettings"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { useOrg } from "@/lib/orgContext"
import { SettingsSection } from "./SettingsSection"

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

export function StoreHoursSection() {
  const tToast = useTranslations("manager.toasts")
  const tSettings = useTranslations("manager.settings")
  const tCommon = useTranslations("common")
  const tSchedule = useTranslations("manager.schedule")
  const { orgId } = useOrg()
  const [hours, setHours] = useState<DayHours[]>(() => getOrgSettings().hours)
  const [buffer, setBuffer] = useState<number>(() => getOrgSettings().timelineBufferHours)
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
        body: JSON.stringify({ hours, timelineBufferHours: buffer }),
      })
      if (!r.ok) {
        // The API rejects a close time that isn't after the open time, with a
        // specific reason. Show it — "Failed to save store hours" gives the
        // manager nothing to act on when the actual problem is one bad row.
        const body = (await r.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || "")
      }
      updateOrgSettings({ hours, timelineBufferHours: buffer })
      setDirty(false)
      toast.success(tToast("storeHoursSaved"))
    } catch (err) {
      const detail = err instanceof Error ? err.message : ""
      toast.error(detail || tToast("storeHoursSaveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection icon={Clock} title={tSettings("storeHours.title")} description={tSettings("storeHours.description")}>
      <div className="space-y-1 mt-4">
        {DAY_KEYS.map((dayKey, i) => {
          const day = hours[i]
          const name = tSettings(`storeHours.days.${dayKey}`)
          return (
            <div
              key={dayKey}
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
                <span className="flex-1 text-sm text-gray-400 dark:text-gray-500">{tSchedule("closed")}</span>
              )}
              <button
                type="button"
                onClick={() => updateDay(i, { isOpen: !day.isOpen })}
                className={cn(
                  "ml-auto shrink-0 text-xs font-medium px-2.5 py-1 rounded-full transition-colors",
                  day.isOpen
                    ? "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50"
                    : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-700"
                )}
              >
                {day.isOpen ? tSettings("storeHours.setClosed") : tSettings("storeHours.setOpen")}
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="timeline-buffer" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {tSettings("storeHours.timelineBuffer")}
          </label>
          <select
            id="timeline-buffer"
            value={buffer}
            onChange={(e) => { setBuffer(Number(e.target.value)); setDirty(true) }}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {Array.from(
              { length: MAX_TIMELINE_BUFFER_HOURS - MIN_TIMELINE_BUFFER_HOURS + 1 },
              (_, i) => MIN_TIMELINE_BUFFER_HOURS + i,
            ).map((n) => (
              <option key={n} value={n}>{tSettings("storeHours.hoursOption", { n })}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500 dark:text-gray-400">{tSettings("storeHours.beforeAfterOpening")}</span>
        </div>
        <div className="flex items-end justify-between gap-4">
          <p className="text-xs text-gray-400">
            {tSettings("storeHours.bufferHint")}
          </p>
          <Button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 shrink-0"
            size="sm"
          >
            {saving ? tCommon("saving") : tSettings("save")}
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
