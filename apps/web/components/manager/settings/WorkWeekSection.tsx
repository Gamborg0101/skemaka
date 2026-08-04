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
      title="Full-time work week"
      description="How many hours a week count as full-time. Used to set contracted hours for full-time staff."
    >
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="full-time-hours">Full-time</Label>
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
            <span className="text-sm text-gray-500 dark:text-gray-400">hours / week</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reduced-full-time-hours">Reduced full-time</Label>
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
            <span className="text-sm text-gray-500 dark:text-gray-400">hours / week</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        In Denmark a standard full-time week is 37 hours; it&rsquo;s 40 in much of the world.
        Part-time staff keep their own custom hours.
      </p>

      {valid && reducedNum >= fullTimeNum && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
          Reduced full-time is usually fewer hours than full-time.
        </p>
      )}

      {dirty && (
        <div className="mt-4 flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={!valid || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {!valid && (
            <span className="text-xs text-red-500">
              Enter whole numbers between {MIN_WORK_WEEK_HOURS} and {MAX_WORK_WEEK_HOURS}.
            </span>
          )}
        </div>
      )}
    </SettingsSection>
  )
}
