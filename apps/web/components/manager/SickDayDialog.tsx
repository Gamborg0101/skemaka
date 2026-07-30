"use client"

import { AlertTriangle, Clock } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatTime } from "@/lib/dateUtils"
import { getOrgSettings } from "@/lib/orgSettings"
import type { Shift, Employee } from "@/types"

interface SickDayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift: Shift
  employee: Employee
  onDelete: (shiftId: string) => void
}

export function SickDayDialog({
  open,
  onOpenChange,
  shift,
  employee,
  onDelete,
}: SickDayDialogProps) {
  const tf = getOrgSettings().timeFormat
  const date = new Date(shift.date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  const hasHours = shift.startTime !== "00:00" || shift.endTime !== "00:00"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Sick Day</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3 py-1">
          <div className="size-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="size-5 text-rose-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-50">{employee.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{date}</p>
          </div>
        </div>
        {hasHours && (
          <p className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
            <Clock className="size-3.5 text-gray-400" />
            {formatTime(shift.startTime, tf)}–{formatTime(shift.endTime, tf)}
          </p>
        )}
        {shift.notes && (
          <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
            {shift.notes}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onDelete(shift.id)
              onOpenChange(false)
            }}
          >
            Remove Sick Day
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
