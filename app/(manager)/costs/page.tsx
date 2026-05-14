"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LaborCostTable } from "@/components/manager/LaborCostTable"
import { getMondayOfWeek, addDays, calcHours } from "@/lib/dateUtils"
import { WeekPicker } from "@/components/manager/WeekPicker"
import { getSchedule } from "@/lib/scheduleStore"
import type { WeeklyLaborCost } from "@/types"
import { getEmployees } from "@/lib/employeeStore"

function buildCosts(weekStart: string): WeeklyLaborCost {
  const shifts = (getSchedule(weekStart).shifts ?? []).filter((s) => s.colorTag !== "sick")

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

  const costs = useMemo(() => buildCosts(weekStart), [weekStart])

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
