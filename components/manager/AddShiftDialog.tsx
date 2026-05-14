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
import { Input } from "@/components/ui/input"
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
import { getTemplates, addTemplate, updateTemplate } from "@/lib/templateStore"
import { toast } from "sonner"
import type { Employee, JobRole, ShiftTemplate } from "@/types"


interface AddShiftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: Employee[]
  jobRoles: JobRole[]
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

  // Template state
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState("")

  // Sync pre-filled values and refresh templates whenever the dialog opens
  useEffect(() => {
    if (open) {
      setEmployeeId(defaultEmployeeId)
      setStartTime(defaultStartTime)
      setEndTime(defaultEndTime)
      setBreakMinutes("30")
      setNotes("")
      setShowNotes(false)
      setAppliedTemplateId(null)
      setSavingTemplate(false)
      setTemplateName("")
      setTemplates(getTemplates())
      const emp = employees.find((e) => e.id === defaultEmployeeId)
      setSelectedRole(emp?.jobRole ?? "")
    }
  }, [open, defaultEmployeeId, defaultDate, defaultStartTime, defaultEndTime, employees])

  // When user switches employee, pre-fill their role
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

  const handleUpdateTemplate = () => {
    if (!appliedTemplateId) return
    const tmpl = templates.find((t) => t.id === appliedTemplateId)
    if (!tmpl) return
    const colorTag = jobRoles.find((r) => r.name === selectedRole)?.color ?? null
    updateTemplate(appliedTemplateId, {
      startTime,
      endTime,
      breakMinutes: parseInt(breakMinutes, 10) || 0,
      jobRole: selectedRole,
      colorTag,
    })
    setTemplates(getTemplates())
    toast.success(`Template "${tmpl.name}" updated`)
  }

  const handleSaveTemplate = () => {
    const name = templateName.trim()
    if (!name) return
    const colorTag = jobRoles.find((r) => r.name === selectedRole)?.color ?? null
    const tmpl = addTemplate({
      organizationId: "org-1",
      name,
      startTime,
      endTime,
      breakMinutes: parseInt(breakMinutes, 10) || 0,
      jobRole: selectedRole,
      colorTag,
    })
    setTemplates((prev) => [...prev, tmpl])
    setTemplateName("")
    setSavingTemplate(false)
    toast.success(`Template "${name}" saved`)
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
          <DialogTitle>Add Shift</DialogTitle>
        </DialogHeader>

        {/* Template row */}
        <div className="space-y-2 -mt-1">
          <div className="flex flex-wrap gap-1.5">
            {templates.map((tmpl) => {
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

          {savingTemplate ? (
            <div className="flex items-center gap-2">
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name..."
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleSaveTemplate() }
                  if (e.key === "Escape") setSavingTemplate(false)
                }}
              />
              <Button type="button" size="sm" onClick={handleSaveTemplate} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setSavingTemplate(false)} className="shrink-0">
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {appliedTemplateId && (
                <button
                  type="button"
                  onClick={handleUpdateTemplate}
                  className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                >
                  Update "{templates.find((t) => t.id === appliedTemplateId)?.name}"
                </button>
              )}
              <button
                type="button"
                onClick={() => setSavingTemplate(true)}
                className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
              >
                + Save as new template
              </button>
            </div>
          )}
        </div>

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

          <div className="space-y-1.5">
            <Label>Date</Label>
            <div className="flex items-center h-9 px-3 rounded-md border border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-700">{defaultDate ? formatDayLabel(defaultDate) : "—"}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-start">Start Time</Label>
              <TimePicker id="add-start" value={startTime} onChange={setStartTime} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-end">End Time</Label>
              <TimePicker id="add-end" value={endTime} onChange={setEndTime} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Break</Label>
            <div className="flex gap-1.5">
              {[0, 15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setBreakMinutes(String(mins))}
                  className={cn(
                    "flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors",
                    breakMinutes === String(mins)
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {mins === 0 ? "None" : `${mins}m`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-role">Job Role</Label>
            <Select value={selectedRole} onValueChange={(val) => setSelectedRole(val ?? "")}>
              <SelectTrigger id="add-role" className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {jobRoles.map((r) => (
                  <SelectItem key={r.id} value={r.name}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showNotes ? (
            <div className="space-y-1.5">
              <Label htmlFor="add-notes">Notes</Label>
              <Textarea
                id="add-notes"
                placeholder="Any notes for this shift..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-14"
                autoFocus
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
            >
              + Add note
            </button>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
              Add Shift
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
