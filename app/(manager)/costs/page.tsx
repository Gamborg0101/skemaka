"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LaborCostTable } from "@/components/manager/LaborCostTable"
import { getMondayOfWeek, addDays, calcHours } from "@/lib/dateUtils"
import { WeekPicker } from "@/components/manager/WeekPicker"
import type { WeeklyLaborCost, Shift } from "@/types"
import { getEmployees } from "@/lib/employeeStore"

// ── Mock data ─────────────────────────────────────────────────────────────────
// TODO: fetch from /api/organizations/[orgId]/labor-costs?weekStart=...


function buildMockCosts(weekStart: string): WeeklyLaborCost {
  // Each employee has a couple of shifts this week
  type ShiftSeed = { employeeId: string; startTime: string; endTime: string; breakMinutes: number; jobRole: string }
  const shiftSeeds: ShiftSeed[] = [
    { employeeId: "emp-1", startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "Barista" },
    { employeeId: "emp-1", startTime: "09:00", endTime: "17:00", breakMinutes: 30, jobRole: "Barista" },
    { employeeId: "emp-1", startTime: "08:00", endTime: "13:00", breakMinutes: 0, jobRole: "Barista" },
    { employeeId: "emp-2", startTime: "10:00", endTime: "18:00", breakMinutes: 30, jobRole: "Server" },
    { employeeId: "emp-2", startTime: "12:00", endTime: "20:00", breakMinutes: 30, jobRole: "Server" },
    { employeeId: "emp-3", startTime: "07:00", endTime: "14:00", breakMinutes: 0, jobRole: "Kitchen" },
    { employeeId: "emp-3", startTime: "07:00", endTime: "15:00", breakMinutes: 30, jobRole: "Kitchen" },
    { employeeId: "emp-3", startTime: "07:00", endTime: "14:00", breakMinutes: 0, jobRole: "Kitchen" },
    { employeeId: "emp-4", startTime: "12:00", endTime: "20:00", breakMinutes: 30, jobRole: "Barista" },
    { employeeId: "emp-4", startTime: "14:00", endTime: "22:00", breakMinutes: 30, jobRole: "Barista" },
  ]

  const shifts: Shift[] = shiftSeeds.map((s, i) => ({
    id: `shift-cost-${i}`,
    scheduleId: "sched-1",
    organizationId: "org-1",
    date: weekStart,
    notes: null,
    colorTag: "blue",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...s,
  }))

  const entries = getEmployees().map((emp) => {
    const empShifts = shifts.filter((s) => s.employeeId === emp.id)
    const totalHours = empShifts.reduce(
      (sum, s) => sum + calcHours(s.startTime, s.endTime, s.breakMinutes),
      0
    )
    return {
      employee: emp,
      totalHours: Math.round(totalHours * 100) / 100,
      totalCost: Math.round(totalHours * emp.hourlyWage * 100) / 100,
      shifts: empShifts,
    }
  })

  const totalHours = entries.reduce((sum, e) => sum + e.totalHours, 0)
  const totalCost = entries.reduce((sum, e) => sum + e.totalCost, 0)

  return {
    weekStart,
    totalHours: Math.round(totalHours * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    entries,
  }
}


export default function CostsPage() {
  const [weekStart, setWeekStart] = useState<string>(getMondayOfWeek(new Date()))

  const costs = useMemo(() => buildMockCosts(weekStart), [weekStart])

  const navigateWeek = (direction: -1 | 1) => {
    setWeekStart((prev) => addDays(prev, direction * 7))
  }

  const isCurrentWeek = getMondayOfWeek(new Date()) === weekStart

  const goToToday = () => setWeekStart(getMondayOfWeek(new Date()))

  return (
    <div className="px-4 md:px-6 py-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Labor Cost</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            disabled={isCurrentWeek}
            className="mr-1"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => navigateWeek(-1)}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => navigateWeek(1)}
            aria-label="Next week"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <LaborCostTable costs={costs} />
    </div>
  )
}
