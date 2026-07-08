"use client"

import { useState } from "react"
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

const PRESET_LABELS: Record<Preset, string> = {
  thisWeek: "This week",
  lastWeek: "Last week",
  last2Weeks: "Last 2 weeks",
  thisMonth: "This month",
  lastMonth: "Last month",
  custom: "Custom range",
}

export function ExportTimesheetDialog({ open, onOpenChange, orgId }: Props) {
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
          <DialogTitle>Export timesheet</DialogTitle>
          <DialogDescription>
            Download a payroll-ready CSV of hours for a pay period.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Pay period</Label>
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
              <Label htmlFor="timesheet-from">From</Label>
              <Input
                id="timesheet-from"
                type="date"
                value={range.from}
                max={range.to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timesheet-to">To</Label>
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
            <Label>Hours source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {source === "scheduled" ? "Scheduled shifts (roster)" : "Clocked hours (time clock)"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled shifts (roster)</SelectItem>
                <SelectItem value="clocked">Clocked hours (time clock)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {source === "scheduled"
                ? "Hours as planned on the schedule. Sick shifts are excluded."
                : "Actual clock in/out times, net of breaks. Open entries are excluded."}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={view} onValueChange={(v) => setView(v as typeof view)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {view === "summary" ? "Summary — one row per employee" : "Detailed — one row per shift"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Summary — one row per employee</SelectItem>
                <SelectItem value="detail">Detailed — one row per shift</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleDownload} disabled={invalid}>
            <Download className="size-4 mr-1.5" />
            Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
