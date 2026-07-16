"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TimePicker } from "@/components/manager/TimePicker"
import { AlertTriangle } from "lucide-react"
import { formatTime, formatDayLabel, grossShiftMinutes } from "@/lib/dateUtils"
import { getOrgSettings } from "@/lib/orgSettings"
import { cn } from "@/lib/utils"
import type { Employee, JobRole, ShiftTemplate } from "@/types"
import type { AvailabilityConflict } from "@/lib/useScheduleData"

interface AddShiftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: Employee[]
  jobRoles: JobRole[]
  shiftTemplates: ShiftTemplate[]
  defaultEmployeeId?: string
  defaultDate?: string
  defaultStartTime?: string
  defaultEndTime?: string
  /** Soft availability warning: returns why this employee shouldn't work this day. */
  getConflict?: (employeeId: string, date: string) => AvailabilityConflict | null
  onShiftCreate: (data: {
    employeeId: string
    date: string
    startTime: string
    endTime: string
    breakMinutes: number
    jobRole: string
    notes: string | null
    colorTag: string | null
  }) => void | boolean | Promise<void | boolean>
  /** Register the whole day as a sick day for this employee instead of a shift. */
  onMarkSick?: (
    employeeId: string,
    date: string,
    details: { startTime: string; endTime: string; reason: string },
  ) => void
}

export function AddShiftDialog({
  open,
  onOpenChange,
  employees,
  jobRoles,
  shiftTemplates,
  defaultEmployeeId = "",
  defaultDate = "",
  defaultStartTime = "09:00",
  defaultEndTime = "17:00",
  onShiftCreate,
  onMarkSick,
  getConflict,
}: AddShiftDialogProps) {
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId)
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("17:00")
  const [breakMinutes, setBreakMinutes] = useState("30")
  const [selectedRole, setSelectedRole] = useState("")
  const [notes, setNotes] = useState("")
  const [showNotes, setShowNotes] = useState(false)
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Sick mode: register the whole day as a sick day instead of a normal shift.
  const [sick, setSick] = useState(false)
  const [sickReason, setSickReason] = useState("")
  // Last start/end pair the break auto-suggest has seen. Pre-set on open and on
  // template apply so the suggestion only fires when the user edits the times.
  const [prevBreakSuggestKey, setPrevBreakSuggestKey] = useState(`${startTime}__${endTime}`)

  // Track when the dialog transitions from closed to open, or when pre-fill props
  // change while open, so we can reset form fields during render (avoids calling
  // setState synchronously inside an effect).
  const openKey = `${open ? 1 : 0}__${defaultEmployeeId}__${defaultDate}__${defaultStartTime}__${defaultEndTime}`
  // Starts empty so a dialog mounted already-open still gets its fields prefilled.
  const [prevOpenKey, setPrevOpenKey] = useState("")

  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey)
    if (open) {
      setPrevBreakSuggestKey(`${defaultStartTime}__${defaultEndTime}`)
      setEmployeeId(defaultEmployeeId)
      setStartTime(defaultStartTime)
      setEndTime(defaultEndTime)
      setBreakMinutes("30")
      setNotes("")
      setShowNotes(false)
      setAppliedTemplateId(null)
      setSubmitting(false)
      setSick(false)
      setSickReason("")
      const emp = employees.find((e) => e.id === defaultEmployeeId)
      setSelectedRole(emp?.jobRole ?? "")
    }
  }

  // When the employee selection changes while open, update the role suggestion
  // during render (adjust state during render pattern).
  const [prevEmployeeId, setPrevEmployeeId] = useState(employeeId)
  if (open && employeeId !== prevEmployeeId) {
    setPrevEmployeeId(employeeId)
    const emp = employees.find((e) => e.id === employeeId)
    setSelectedRole(emp?.jobRole ?? "")
  }

  // Auto-suggest break based on shift duration (only when user changes times, not on
  // open/template — those paths pre-set prevBreakSuggestKey to the incoming times).
  const breakSuggestKey = `${startTime}__${endTime}`
  if (breakSuggestKey !== prevBreakSuggestKey) {
    setPrevBreakSuggestKey(breakSuggestKey)
    const mins = grossShiftMinutes(startTime, endTime)
    if (mins < 360) setBreakMinutes("0")
    else if (mins < 540) setBreakMinutes("30")
    else setBreakMinutes("45")
  }

  const applyTemplate = (tmpl: ShiftTemplate) => {
    setPrevBreakSuggestKey(`${tmpl.startTime}__${tmpl.endTime}`)
    setStartTime(tmpl.startTime)
    setEndTime(tmpl.endTime)
    setBreakMinutes(String(tmpl.breakMinutes))
    if (tmpl.jobRole) setSelectedRole(tmpl.jobRole)
    setAppliedTemplateId(tmpl.id)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeeId || !defaultDate || submitting) return

    // Sick mode: mark the whole day as a sick day (no shift hours/role) and close.
    if (sick) {
      onMarkSick?.(employeeId, defaultDate, { startTime: "00:00", endTime: "00:00", reason: sickReason })
      onOpenChange(false)
      return
    }

    if (!startTime || !endTime) return
    setSubmitting(true)
    const colorTag = jobRoles.find((r) => r.name === selectedRole)?.color ?? "gray"
    try {
      const result = await onShiftCreate({
        employeeId,
        date: defaultDate,
        startTime,
        endTime,
        breakMinutes: parseInt(breakMinutes, 10) || 0,
        jobRole: selectedRole,
        notes: notes.trim() || null,
        colorTag,
      })
      // Keep the dialog open when the create explicitly failed so the manager
      // can adjust and retry without re-entering everything. Legacy creators
      // that return void are treated as success (close).
      if (result !== false) onOpenChange(false)
    } catch {
      // onShiftCreate handles its own error toasts — just re-enable the button
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {sick ? "Mark Sick Day" : "Add Shift"}
            {defaultDate && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                {formatDayLabel(defaultDate)}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Soft availability warning — the manager can still schedule anyway. */}
        {(() => {
          const conflict = getConflict && employeeId && defaultDate ? getConflict(employeeId, defaultDate) : null
          if (!conflict) return null
          const empName = employees.find((e) => e.id === employeeId)?.name ?? "This person"
          return (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <span>
                {conflict.type === "timeoff"
                  ? `${empName} is on approved time off this day.`
                  : `${empName} marked this day as unavailable.`}{" "}
                You can still schedule them.
              </span>
            </div>
          )
        })()}

        {/* Shift type presets */}
        {!sick && shiftTemplates.length > 0 && (
          <div className="flex flex-wrap gap-1.5 -mt-1">
            {shiftTemplates.map((tmpl) => {
              const isActive = tmpl.id === appliedTemplateId
              const tf = getOrgSettings().timeFormat
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => applyTemplate(tmpl)}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors",
                    isActive
                      ? "bg-blue-50 dark:bg-gray-700/60 border-blue-300 dark:border-gray-500 text-blue-700 dark:text-gray-100"
                      : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700/40 hover:border-blue-200 dark:hover:border-gray-600 hover:text-blue-700 dark:hover:text-gray-200"
                  )}
                >
                  <span className="font-medium">{tmpl.name}</span>
                  <span className={isActive ? "text-blue-400" : "text-gray-400"}>
                    {formatTime(tmpl.startTime, tf)}–{formatTime(tmpl.endTime, tf)}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="border-t border-gray-100 dark:border-gray-700" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="add-employee">Employee</Label>
            <Select value={employeeId} onValueChange={(val) => setEmployeeId(val ?? "")}>
              <SelectTrigger id="add-employee" className="w-full">
                <SelectValue>
                  <span className={employeeId ? "text-foreground" : "text-muted-foreground"}>
                    {employeeId
                      ? (employees.find((e) => e.id === employeeId)?.name ?? "Select employee")
                      : "Select employee"}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mark-as-sick toggle — turns this into a full sick day for the whole day. */}
          {onMarkSick && (
            <label className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
              sick
                ? "border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30"
                : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            )}>
              <input
                type="checkbox"
                checked={sick}
                onChange={(e) => setSick(e.target.checked)}
                className="size-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
              />
              <AlertTriangle className={cn("size-4 shrink-0", sick ? "text-rose-500" : "text-gray-400")} />
              <span className="min-w-0 flex-1 text-sm">
                <span className={cn("font-medium", sick ? "text-rose-700 dark:text-rose-300" : "text-gray-700 dark:text-gray-200")}>
                  Mark as sick day
                </span>
                <span className="block text-xs text-gray-400 dark:text-gray-500">
                  Registers the whole day as a sick day — no shift hours.
                </span>
              </span>
            </label>
          )}

          {sick ? (
            <div className="space-y-1.5">
              <Label htmlFor="sick-reason">Reason (optional)</Label>
              <Textarea
                id="sick-reason"
                placeholder="e.g. Flu / fever"
                value={sickReason}
                onChange={(e) => setSickReason(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
          ) : (
          <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start time</Label>
              <TimePicker value={startTime} onChange={setStartTime} />
            </div>
            <div className="space-y-1.5">
              <Label>End time</Label>
              <TimePicker value={endTime} onChange={setEndTime} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-break">Break</Label>
              <Select value={breakMinutes} onValueChange={(v) => { if (v) setBreakMinutes(v) }}>
                <SelectTrigger id="add-break" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No break</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-role">Job role</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v ?? "")}>
                <SelectTrigger id="add-role" className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {jobRoles.map((r) => (
                    <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {showNotes ? (
            <div className="space-y-1.5">
              <Label htmlFor="add-notes">Notes</Label>
              <Textarea
                id="add-notes"
                placeholder="Optional note for this shift…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              + Add a note
            </button>
          )}
          </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!employeeId || !defaultDate || submitting}
              className={cn(
                "text-white",
                sick ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {sick ? "Mark sick" : submitting ? "Adding…" : "Add shift"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
