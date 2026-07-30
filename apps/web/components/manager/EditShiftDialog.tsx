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
import { DateStepper } from "@/components/manager/DateStepper"
import { grossShiftMinutes } from "@/lib/dateUtils"
import type { Shift, JobRole } from "@/types"

interface EditShiftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift: Shift
  jobRoles: JobRole[]
  onShiftUpdate: (data: Partial<Shift>) => void
  onShiftDelete: (shiftId: string) => void
  onShiftCancel?: (shiftId: string) => void
}

export function EditShiftDialog({
  open,
  onOpenChange,
  shift,
  jobRoles,
  onShiftUpdate,
  onShiftDelete,
  onShiftCancel,
}: EditShiftDialogProps) {
  const [date, setDate] = useState(shift.date)
  const [startTime, setStartTime] = useState(shift.startTime)
  const [endTime, setEndTime] = useState(shift.endTime)
  const [breakMinutes, setBreakMinutes] = useState(String(shift.breakMinutes))
  const [selectedRole, setSelectedRole] = useState(shift.jobRole)
  const [notes, setNotes] = useState(shift.notes ?? "")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  // Last start/end pair the break auto-suggest has seen. Pre-set on open so the
  // suggestion only fires when the user edits the times.
  const [prevBreakSuggestKey, setPrevBreakSuggestKey] = useState(`${startTime}__${endTime}`)

  // Track when the dialog transitions from closed→open, or when shift prop changes,
  // to re-populate fields during render (adjust state during render pattern).
  const openKey = `${open ? 1 : 0}__${shift.id}`
  const [prevOpenKey, setPrevOpenKey] = useState(openKey)
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey)
    if (open) {
      setPrevBreakSuggestKey(`${shift.startTime}__${shift.endTime}`)
      setDate(shift.date)
      setStartTime(shift.startTime)
      setEndTime(shift.endTime)
      setBreakMinutes(String(shift.breakMinutes))
      setSelectedRole(shift.jobRole)
      setNotes(shift.notes ?? "")
      setConfirmDelete(false)
      setConfirmCancel(false)
    }
  }

  // Auto-suggest break based on shift duration (only when user changes times, not on
  // open — the open path pre-sets prevBreakSuggestKey to the incoming shift's times).
  const breakSuggestKey = `${startTime}__${endTime}`
  if (breakSuggestKey !== prevBreakSuggestKey) {
    setPrevBreakSuggestKey(breakSuggestKey)
    const mins = grossShiftMinutes(startTime, endTime)
    if (mins < 360) setBreakMinutes("0")
    else if (mins < 540) setBreakMinutes("30")
    else setBreakMinutes("45")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const colorTag = jobRoles.find((r) => r.name === selectedRole)?.color ?? shift.colorTag
    onShiftUpdate({
      id: shift.id,
      date,
      startTime,
      endTime,
      breakMinutes: parseInt(breakMinutes, 10) || 0,
      jobRole: selectedRole,
      notes: notes.trim() || null,
      colorTag,
    })
    onOpenChange(false)
  }

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setConfirmCancel(false)
      return
    }
    onShiftDelete(shift.id)
    onOpenChange(false)
  }

  const handleCancel = () => {
    if (!confirmCancel) {
      setConfirmCancel(true)
      setConfirmDelete(false)
      return
    }
    onShiftCancel?.(shift.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Shift</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <DateStepper value={date} onChange={setDate} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-start">Start Time</Label>
              <TimePicker
                id="edit-start"
                value={startTime}
                onChange={setStartTime}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end">End Time</Label>
              <TimePicker
                id="edit-end"
                value={endTime}
                onChange={setEndTime}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-break">Break (minutes)</Label>
            <Input
              id="edit-break"
              type="number"
              min="0"
              max="120"
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-role">Job Role</Label>
            <Select value={selectedRole} onValueChange={(val) => setSelectedRole(val ?? "")}>
              <SelectTrigger id="edit-role" className="w-full">
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

          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes (optional)</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-14"
            />
          </div>

          {confirmCancel && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2">
              The shift stays on the schedule as a cancelled record, and the employee is
              notified right away. The rest of the week stays published.
            </p>
          )}
          <DialogFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              className="mr-auto"
            >
              {confirmDelete ? "Confirm Delete" : "Delete"}
            </Button>
            {onShiftCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              >
                {confirmCancel ? "Notify & Cancel" : "Cancel Shift"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
