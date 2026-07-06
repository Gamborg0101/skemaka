"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Send } from "lucide-react"
import { addDays } from "@/lib/dateUtils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  weekStart: string          // YYYY-MM-DD (Monday of the requested week)
  weekLabel: string          // human label for that week
  employeeCount: number
  sending: boolean
  onConfirm: (deadlineISO: string) => void
}

/** Local YYYY-MM-DD for today (used as the min bound for the deadline input). */
function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Sensible default deadline: two days before the requested week starts, but
 * never in the past — fall back to tomorrow so the manager always sends a
 * future deadline. Staff need a window to respond before the roster is built.
 */
function defaultDeadline(weekStart: string): string {
  const today = todayISO()
  const twoBefore = addDays(weekStart, -2)
  const tomorrow = addDays(today, 1)
  return twoBefore > today ? twoBefore : tomorrow
}

export function SendAvailabilityDialog({
  open,
  onOpenChange,
  weekStart,
  weekLabel,
  employeeCount,
  sending,
  onConfirm,
}: Props) {
  const [deadline, setDeadline] = useState(() => defaultDeadline(weekStart))

  // Re-seed the default whenever the dialog opens for a different week.
  useEffect(() => {
    if (open) setDeadline(defaultDeadline(weekStart))
  }, [open, weekStart])

  const min = todayISO()
  const invalid = !deadline || deadline < min

  const handleConfirm = () => {
    if (invalid) return
    // End-of-day local time on the chosen date, as an ISO timestamp.
    const d = new Date(`${deadline}T23:59:59`)
    onConfirm(d.toISOString())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send availability request</DialogTitle>
          <DialogDescription>
            Emails a link to{" "}
            {employeeCount === 1 ? "1 active employee" : `all ${employeeCount} active employees`}{" "}
            so they can mark which days they can work.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Week requested
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{weekLabel}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="availability-deadline">Respond by</Label>
            <Input
              id="availability-deadline"
              type="date"
              value={deadline}
              min={min}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Staff can submit any time up to the end of this day.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={sending || invalid}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Send className="size-4" />
            {sending ? "Sending..." : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
