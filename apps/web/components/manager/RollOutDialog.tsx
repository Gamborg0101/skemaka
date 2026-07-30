"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Send, Users, CalendarRange } from "lucide-react"
import { toast } from "sonner"
import { formatWeekLabel } from "@/lib/dateUtils"

interface PendingWeek {
  weekStart: string
  shiftCount: number
  employeeIds: string[]
  employeeNames: string[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  /** Called after a successful roll-out (fromWeek, toWeek) so the page can refresh. */
  onRolledOut: (fromWeek: string, toWeek: string) => void
}

/**
 * Rolls out (publishes) every draft week that has shifts, from the earliest up
 * to a chosen end week — one action for a whole period (a few weeks up to
 * months). Everyone with a shift in the range is notified once.
 */
export function RollOutDialog({ open, onOpenChange, orgId, onRolledOut }: Props) {
  const [weeks, setWeeks] = useState<PendingWeek[] | null>(null)
  const [throughWeek, setThroughWeek] = useState<string>("")
  const [rolling, setRolling] = useState(false)
  // Captured when the dialog opens — Date.now() is impure and must not run
  // during render (react-compiler rule); open-time precision is plenty for
  // the weeks-ahead nudge.
  const [openedAt, setOpenedAt] = useState(0)

  // Load the draft weeks each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setWeeks(null)
    setOpenedAt(Date.now())
    fetch(`/api/orgs/${orgId}/schedules/roll-out`)
      .then((r) => r.json())
      .then((d: { data?: PendingWeek[] }) => {
        const w = d.data ?? []
        setWeeks(w)
        if (w.length > 0) setThroughWeek(w[w.length - 1].weekStart)
      })
      .catch(() => setWeeks([]))
  }, [open, orgId])

  const fromWeek = weeks && weeks.length > 0 ? weeks[0].weekStart : ""

  // Weeks included given the chosen "through" week, and who they'd notify.
  const included = useMemo(
    () => (weeks ?? []).filter((w) => w.weekStart <= throughWeek),
    [weeks, throughWeek],
  )
  const affectedCount = useMemo(() => {
    const ids = new Set<string>()
    for (const w of included) for (const id of w.employeeIds) ids.add(id)
    return ids.size
  }, [included])

  const loading = weeks === null
  const nothing = weeks !== null && weeks.length === 0

  async function confirm() {
    if (!fromWeek || !throughWeek) return
    setRolling(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}/schedules/roll-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromWeek, toWeek: throughWeek }),
      })
      const d = await r.json() as { data?: { weeks: number; notified: number }; error?: string }
      if (!r.ok || !d.data) {
        toast.error(d.error ?? "Failed to roll out")
        return
      }
      const { weeks: n, notified } = d.data
      toast.success(
        `Rolled out ${n} ${n === 1 ? "week" : "weeks"} — ${notified} ${notified === 1 ? "person" : "people"} notified`,
      )
      onRolledOut(fromWeek, throughWeek)
      onOpenChange(false)
    } catch {
      toast.error("Failed to roll out")
    } finally {
      setRolling(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Roll out the schedule</DialogTitle>
          <DialogDescription>
            Send your draft shifts to the team, all at once. Everyone getting new shifts is notified once.
          </DialogDescription>
        </DialogHeader>

        <div className="py-1 space-y-4 min-h-24">
          {loading ? (
            <p className="text-sm text-gray-400 py-6 text-center">Loading draft weeks…</p>
          ) : nothing ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
              Nothing to roll out — no draft shifts yet. Add shifts, then roll out.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Roll out through</label>
                <Select value={throughWeek} onValueChange={(v) => { if (v) setThroughWeek(v) }}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{throughWeek ? formatWeekLabel(throughWeek) : ""}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(weeks ?? []).map((w) => (
                      <SelectItem key={w.weekStart} value={w.weekStart}>
                        {formatWeekLabel(w.weekStart)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400">
                  Draft shifts from {formatWeekLabel(fromWeek)} up to your choice are sent; later drafts stay private.
                </p>
                {/* "Spil efter reglerne": Danish hospitality agreements expect
                    schedules to be known 4 weeks ahead. Quiet nudge, no gating. */}
                {openedAt > 0 && (() => {
                  const weeksAhead = Math.floor(
                    (Date.parse(throughWeek + "T00:00:00Z") - openedAt) / (7 * 24 * 60 * 60 * 1000),
                  ) + 1
                  return (
                    <p className={`text-xs ${weeksAhead >= 4 ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                      {weeksAhead >= 4
                        ? `Covers ${weeksAhead} weeks ahead — within the 4-week notice Danish agreements expect.`
                        : `Covers ${Math.max(weeksAhead, 0)} ${weeksAhead === 1 ? "week" : "weeks"} ahead. Danish agreements expect schedules 4 weeks in advance — draft further ahead when you can.`}
                    </p>
                  )
                })()}
              </div>

              {/* Review list — exactly what this roll-out will send, per week. */}
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 max-h-48 overflow-y-auto">
                {included.map((w) => (
                  <div key={w.weekStart} className="px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <CalendarRange className="size-4 shrink-0 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">{formatWeekLabel(w.weekStart)}</span>
                      <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
                        {w.shiftCount} {w.shiftCount === 1 ? "draft shift" : "draft shifts"}
                      </span>
                    </div>
                    <p className="mt-0.5 pl-6 text-xs text-gray-500 dark:text-gray-400 truncate">
                      {w.employeeNames.slice(0, 4).join(", ")}
                      {w.employeeNames.length > 4 && ` +${w.employeeNames.length - 4} more`}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-3 text-sm">
                <Users className="size-5 shrink-0 text-gray-400" />
                <p className="text-gray-700 dark:text-gray-200">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {affectedCount} {affectedCount === 1 ? "person" : "people"}
                  </span>{" "}
                  will be notified.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={rolling}>
            Cancel
          </Button>
          <Button
            onClick={confirm}
            disabled={rolling || loading || nothing}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Send className="size-4" />
            {rolling ? "Rolling out…" : "Roll out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
