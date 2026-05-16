"use client"

import { useState, useEffect } from "react"
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
import { formatTime, formatDayLabel } from "@/lib/dateUtils"
import { cn } from "@/lib/utils"
import type { Employee, JobRole, ShiftTemplate } from "@/types"

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
  onShiftCreate: (data: {
    employeeId: string
    date: string
    startTime: string
    endTime: string
    breakMinutes: number
    jobRole: string
    notes: string | null
    colorTag: string | null
  }) => void
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
}: AddShiftDialogProps) {
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId)
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("17:00")
  const [breakMinutes, setBreakMinutes] = useState("30")
  const [selectedRole, setSelectedRole] = useState("")
  const [notes, setNotes] = useState("")
  const [showNotes, setShowNotes] = useState(false)
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null)

  // Sync pre-filled values whenever the dialog opens
  useEffect(() => {
    if (open) {
      setEmployeeId(defaultEmployeeId)
      setStartTime(defaultStartTime)
      setEndTime(defaultEndTime)
      setBreakMinutes("30")
      setNotes("")
      setShowNotes(false)
      setAppliedTemplateId(null)
      const emp = employees.find((e) => e.id === defaultEmployeeId)
      setSelectedRole(emp?.jobRole ?? "")
    }
  }, [open, defaultEmployeeId, defaultDate, defaultStartTime, defaultEndTime, employees])

  // When employee changes, pre-fill their role
  useEffect(() => {
    const emp = employees.find((e) => e.id === employeeId)
    setSelectedRole(emp?.jobRole ?? "")
  }, [employeeId, employees])

  // Auto-suggest break based on shift duration
  useEffect(() => {
    const [sh, sm] = startTime.split(":").map(Number)
    const [eh, em] = endTime.split(":").map(Number)
    const mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins < 360) setBreakMinutes("0")
    else if (mins < 540) setBreakMinutes("30")
    else setBreakMinutes("45")
  }, [startTime, endTime])

  const applyTemplate = (tmpl: ShiftTemplate) => {
    setStartTime(tmpl.startTime)
    setEndTime(tmpl.endTime)
    setBreakMinutes(String(tmpl.breakMinutes))
    if (tmpl.jobRole) setSelectedRole(tmpl.jobRole)
    setAppliedTemplateId(tmpl.id)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeeId || !defaultDate || !startTime || !endTime) return
    const colorTag = jobRoles.find((r) => r.name === selectedRole)?.color ?? "gray"
    onShiftCreate({
      employeeId,
      date: defaultDate,
      startTime,
      endTime,
      breakMinutes: parseInt(breakMinutes, 10) || 0,
      jobRole: selectedRole,
      notes: notes.trim() || null,
      colorTag,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Add Shift
            {defaultDate && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                {formatDayLabel(defaultDate)}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Shift type presets */}
        {shiftTemplates.length > 0 && (
          <div className="flex flex-wrap gap-1.5 -mt-1">
            {shiftTemplates.map((tmpl) => {
              const isActive = tmpl.id === appliedTemplateId
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => applyTemplate(tmpl)}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors",
                    isActive
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                  )}
                >
                  <span className="font-medium">{tmpl.name}</span>
                  <span className={isActive ? "text-blue-400" : "text-gray-400"}>
                    {formatTime(tmpl.startTime)}–{formatTime(tmpl.endTime)}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="border-t border-gray-100" />

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
              className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
            >
              + Add a note
            </button>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!employeeId || !defaultDate}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Add shift
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
