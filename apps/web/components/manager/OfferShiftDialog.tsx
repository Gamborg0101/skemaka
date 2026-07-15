"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TimePicker } from "@/components/manager/TimePicker"
import { Send } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { addDays } from "@/lib/dateUtils"
import type { Employee, JobRole } from "@/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  jobRoles: JobRole[]
  employees: Employee[]
  onCreated: () => void
}

/** Local YYYY-MM-DD for today (min bound for date/deadline inputs). */
function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function OfferShiftDialog({ open, onOpenChange, orgId, jobRoles, employees, onCreated }: Props) {
  const activeEmployees = employees.filter((e) => e.isActive)

  const [date, setDate] = useState(() => addDays(todayISO(), 1))
  const [startTime, setStartTime] = useState("17:00")
  const [endTime, setEndTime] = useState("23:00")
  const [breakMinutes, setBreakMinutes] = useState("30")
  const [jobRole, setJobRole] = useState("")
  const [note, setNote] = useState("")
  const [deadline, setDeadline] = useState(() => todayISO())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  // Reset fields when the dialog transitions closed → open (adjust-during-render).
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setDate(addDays(todayISO(), 1))
      setStartTime("17:00")
      setEndTime("23:00")
      setBreakMinutes("30")
      setJobRole("")
      setNote("")
      setDeadline(todayISO())
      setSelected(new Set())
      setSubmitting(false)
    }
  }

  const today = todayISO()
  // People matching the chosen role float to the top as a gentle suggestion.
  const sortedEmployees = jobRole
    ? [...activeEmployees].sort((a, b) => Number(b.jobRole === jobRole) - Number(a.jobRole === jobRole))
    : activeEmployees

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const invalid = !date || !jobRole || !deadline || deadline < today || selected.size === 0 || startTime === endTime

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (invalid || submitting) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}/shift-offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          startTime,
          endTime,
          jobRole,
          breakMinutes: parseInt(breakMinutes, 10) || 0,
          note: note.trim() || null,
          // End-of-day local on the chosen date, as an ISO timestamp.
          deadline: new Date(`${deadline}T23:59:59`).toISOString(),
          employeeIds: [...selected],
        }),
      })
      const res = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) throw new Error(res.error ?? "Failed to send shift offer")
      toast.success(`Shift offered to ${selected.size} ${selected.size === 1 ? "person" : "people"}`)
      onCreated()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send shift offer")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Offer a shift</DialogTitle>
          <DialogDescription>
            Offer a shift to people you pick. Whoever accepts becomes a candidate — you confirm who gets it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="offer-date">Date</Label>
            <Input
              id="offer-date"
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
            />
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
              <Label htmlFor="offer-break">Break</Label>
              <Select value={breakMinutes} onValueChange={(v) => { if (v) setBreakMinutes(v) }}>
                <SelectTrigger id="offer-break" className="w-full">
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
              <Label htmlFor="offer-role">Job role</Label>
              <Select value={jobRole} onValueChange={(v) => setJobRole(v ?? "")}>
                <SelectTrigger id="offer-role" className="w-full">
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

          <div className="space-y-1.5">
            <Label htmlFor="offer-deadline">Respond by</Label>
            <Input
              id="offer-deadline"
              type="date"
              value={deadline}
              min={today}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              People can accept up to the end of this day.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Offer to</Label>
              <span className="text-xs text-gray-400">{selected.size} selected</span>
            </div>
            {activeEmployees.length === 0 ? (
              <p className="text-sm text-gray-400">No active employees to offer this to.</p>
            ) : (
              <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
                {sortedEmployees.map((emp) => {
                  const checked = selected.has(emp.id)
                  return (
                    <label
                      key={emp.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
                        checked ? "bg-blue-50/60 dark:bg-blue-950/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(emp.id)}
                        className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="min-w-0 flex-1 text-sm text-gray-900 dark:text-gray-100 truncate">{emp.name}</span>
                      <span className={cn(
                        "text-xs shrink-0",
                        jobRole && emp.jobRole === jobRole ? "text-blue-600 dark:text-blue-400 font-medium" : "text-gray-400"
                      )}>
                        {emp.jobRole}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="offer-note">Note (optional)</Label>
            <Textarea
              id="offer-note"
              placeholder="Anything the team should know…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[52px]"
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={invalid || submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Send className="size-4" />
              {submitting ? "Sending…" : "Send offer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
