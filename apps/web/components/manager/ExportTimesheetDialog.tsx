"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { getMondayOfWeek, addDays } from "@/lib/dateUtils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
}

type Preset = "thisWeek" | "lastWeek" | "last2Weeks" | "thisMonth" | "lastMonth" | "custom"

/** Local YYYY-MM-DD for a Date. */
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date()
  const monday = getMondayOfWeek(now)
  switch (preset) {
    case "thisWeek":
      return { from: monday, to: addDays(monday, 6) }
    case "lastWeek":
      return { from: addDays(monday, -7), to: addDays(monday, -1) }
    case "last2Weeks":
      return { from: addDays(monday, -14), to: addDays(monday, -1) }
    case "thisMonth":
      return {
        from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      }
    case "lastMonth":
      return {
        from: toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: toISODate(new Date(now.getFullYear(), now.getMonth(), 0)),
      }
    case "custom":
      return { from: monday, to: addDays(monday, 6) }
  }
}

function presetLabels(t: ReturnType<typeof useTranslations<"manager.exportTimesheetDialog">>): Record<Preset, string> {
  return {
    thisWeek: t("presetThisWeek"),
    lastWeek: t("presetLastWeek"),
    last2Weeks: t("presetLast2Weeks"),
    thisMonth: t("presetThisMonth"),
    lastMonth: t("presetLastMonth"),
    custom: t("presetCustom"),
  }
}

export function ExportTimesheetDialog({ open, onOpenChange, orgId }: Props) {
  const t = useTranslations("manager.exportTimesheetDialog")
  const tCommon = useTranslations("common")
  const PRESET_LABELS = presetLabels(t)
  const [preset, setPreset] = useState<Preset>("thisWeek")
  const [range, setRange] = useState(() => presetRange("thisWeek"))
  const [source, setSource] = useState<"scheduled" | "clocked">("scheduled")
  const [view, setView] = useState<"summary" | "detail">("summary")

  const applyPreset = (p: Preset) => {
    setPreset(p)
    if (p !== "custom") setRange(presetRange(p))
  }

  const setFrom = (from: string) => { setPreset("custom"); setRange((r) => ({ ...r, from })) }
  const setTo = (to: string) => { setPreset("custom"); setRange((r) => ({ ...r, to })) }

  const invalid = !range.from || !range.to || range.to < range.from

  const handleDownload = () => {
    if (invalid) return
    const params = new URLSearchParams({
      dateFrom: range.from,
      dateTo: range.to,
      source,
      view,
    })
    window.open(`/api/orgs/${orgId}/timesheets/export?${params}`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("payPeriod")}</Label>
            <Select value={preset} onValueChange={(v) => applyPreset(v as Preset)}>
              <SelectTrigger className="w-full">
                <SelectValue>{PRESET_LABELS[preset]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
                  <SelectItem key={p} value={p}>{PRESET_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="timesheet-from">{t("from")}</Label>
              <Input
                id="timesheet-from"
                type="date"
                value={range.from}
                max={range.to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timesheet-to">{t("to")}</Label>
              <Input
                id="timesheet-to"
                type="date"
                value={range.to}
                min={range.from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("hoursSource")}</Label>
            <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {source === "scheduled" ? t("sourceScheduled") : t("sourceClocked")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">{t("sourceScheduled")}</SelectItem>
                <SelectItem value="clocked">{t("sourceClocked")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {source === "scheduled" ? t("sourceScheduledHint") : t("sourceClockedHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t("format")}</Label>
            <Select value={view} onValueChange={(v) => setView(v as typeof view)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {view === "summary" ? t("formatSummary") : t("formatDetail")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">{t("formatSummary")}</SelectItem>
                <SelectItem value="detail">{t("formatDetail")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tCommon("cancel")}</Button>
          <Button onClick={handleDownload} disabled={invalid}>
            <Download className="size-4 mr-1.5" />
            {t("download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
