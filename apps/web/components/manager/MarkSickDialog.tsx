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
import { TimePicker } from "@/components/manager/TimePicker"
import { AlertTriangle } from "lucide-react"
import { formatDayLabel } from "@/lib/dateUtils"

interface MarkSickDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeName: string
  date: string
  onConfirm: (details: { startTime: string; endTime: string; reason: string }) => void
}

export function MarkSickDialog({
  open,
  onOpenChange,
  employeeName,
  date,
  onConfirm,
}: MarkSickDialogProps) {
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("17:00")
  const [reason, setReason] = useState("")

  // Reset the fields whenever the dialog is (re)opened for a new person/date.
  const key = `${open ? 1 : 0}__${employeeName}__${date}`
  const [prevKey, setPrevKey] = useState(key)
  if (key !== prevKey) {
    setPrevKey(key)
    if (open) {
      setStartTime("09:00")
      setEndTime("17:00")
      setReason("")
    }
  }

  const submit = () => {
    onConfirm({ startTime, endTime, reason })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/50">
              <AlertTriangle className="size-4 text-rose-500" />
            </span>
            Mark sick day
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-200">{employeeName}</span>
            {" · "}
            {formatDayLabel(date)}
          </p>

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

          <div className="space-y-1.5">
            <Label htmlFor="sick-reason">Reason (optional)</Label>
            <Textarea
              id="sick-reason"
              placeholder="e.g. Flu / fever"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            Mark sick
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
