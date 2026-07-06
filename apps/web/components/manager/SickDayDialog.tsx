"use client"

import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
  const date = new Date(shift.date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

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
