"use client"

import { useState } from "react"
import { CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getOrgSettings,
  updateOrgSettings,
  MIN_WORK_WEEK_HOURS,
  MAX_WORK_WEEK_HOURS,
} from "@/lib/orgSettings"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { useOrg } from "@/lib/orgContext"
import { SettingsSection } from "./SettingsSection"

export function WorkWeekSection() {
  const tToast = useTranslations("manager.toasts")
  const tSettings = useTranslations("manager.settings")
  const tCommon = useTranslations("common")
  const { orgId } = useOrg()
  const [fullTime, setFullTime] = useState(() => String(getOrgSettings().fullTimeHours))
  const [reduced, setReduced] = useState(() => String(getOrgSettings().reducedFullTimeHours))
  const [saving, setSaving] = useState(false)

  const fullTimeNum = parseInt(fullTime, 10)
  const reducedNum = parseInt(reduced, 10)

  const inRange = (n: number) =>
    Number.isInteger(n) && n >= MIN_WORK_WEEK_HOURS && n <= MAX_WORK_WEEK_HOURS
  const valid = inRange(fullTimeNum) && inRange(reducedNum)

  const dirty =
    fullTimeNum !== getOrgSettings().fullTimeHours ||
    reducedNum !== getOrgSettings().reducedFullTimeHours

  async function handleSave() {
    if (!valid) return
    setSaving(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullTimeHours: fullTimeNum, reducedFullTimeHours: reducedNum }),
      })
      if (!r.ok) throw new Error()
      updateOrgSettings({ fullTimeHours: fullTimeNum, reducedFullTimeHours: reducedNum })
      toast.success(tToast("fullTimeHoursUpdated"))
    } catch {
      toast.error(tToast("fullTimeHoursUpdateFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection
      icon={CalendarClock}
      title={tSettings("workWeek.title")}
      description={tSettings("workWeek.description")}
    >
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="full-time-hours">{tSettings("workWeek.fullTimeLabel")}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="full-time-hours"
              type="number"
              min={MIN_WORK_WEEK_HOURS}
              max={MAX_WORK_WEEK_HOURS}
              value={fullTime}
              onChange={(e) => setFullTime(e.target.value)}
              className="w-24"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">{tSettings("workWeek.hoursPerWeek")}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reduced-full-time-hours">{tSettings("workWeek.reducedLabel")}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="reduced-full-time-hours"
              type="number"
              min={MIN_WORK_WEEK_HOURS}
              max={MAX_WORK_WEEK_HOURS}
              value={reduced}
              onChange={(e) => setReduced(e.target.value)}
              className="w-24"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">{tSettings("workWeek.hoursPerWeek")}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        {tSettings("workWeek.hint")}
      </p>

      {valid && reducedNum >= fullTimeNum && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
          {tSettings("workWeek.reducedWarning")}
        </p>
      )}

      {dirty && (
        <div className="mt-4 flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={!valid || saving}>
            {saving ? tCommon("saving") : tSettings("save")}
          </Button>
          {!valid && (
            <span className="text-xs text-red-500">
              {tSettings("workWeek.rangeError", { min: MIN_WORK_WEEK_HOURS, max: MAX_WORK_WEEK_HOURS })}
            </span>
          )}
        </div>
      )}
    </SettingsSection>
  )
}
