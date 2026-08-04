"use client"

import { Ban } from "lucide-react"
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
import { useLocale } from "next-intl"
import { LOCALE_TAGS, type Locale } from "@skemaka/i18n"
import type { Shift, Employee } from "@/types"

interface CancelledShiftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift: Shift
  employee: Employee
  /** Permanently removes the cancelled record from the schedule. */
  onDelete: (shiftId: string) => void
}

/**
 * Shown when a manager clicks a shift that has already been cancelled. The
 * record is read-only — the only action is removing it from the grid entirely
 * (no notification; the employee was already told when it was cancelled).
 */
export function CancelledShiftDialog({
  open,
  onOpenChange,
  shift,
  employee,
  onDelete,
}: CancelledShiftDialogProps) {
  const tf = getOrgSettings().timeFormat
  const localeTag = LOCALE_TAGS[useLocale() as Locale]
  const date = new Date(shift.date + "T12:00:00").toLocaleDateString(localeTag, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  const cancelledOn = shift.cancelledAt
    ? new Date(shift.cancelledAt).toLocaleDateString(localeTag, {
        day: "numeric",
        month: "long",
      })
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Cancelled Shift</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3 py-1">
          <div className="size-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
            <Ban className="size-5 text-gray-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-50">{employee.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {date} ·{" "}
              <span className="line-through">
                {formatTime(shift.startTime, tf)}–{formatTime(shift.endTime, tf)}
              </span>
            </p>
            {cancelledOn && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Cancelled on {cancelledOn} — the employee was notified.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onDelete(shift.id)
              onOpenChange(false)
            }}
          >
            Remove from Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
