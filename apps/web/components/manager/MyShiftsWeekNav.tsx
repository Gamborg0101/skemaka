"use client"

import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WeekPicker } from "@/components/manager/WeekPicker"
import { addDays, getMondayOfWeek } from "@/lib/dateUtils"

interface MyShiftsWeekNavProps {
  weekStart: string
  employeeParam?: string
}

export function MyShiftsWeekNav({ weekStart, employeeParam }: MyShiftsWeekNavProps) {
  const router = useRouter()
  const currentWeek = getMondayOfWeek(new Date())

  function navigate(week: string) {
    const params = new URLSearchParams({ week })
    if (employeeParam) params.set("employee", employeeParam)
    router.push(`/my-shifts?${params}`)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => navigate(addDays(weekStart, -7))}
          aria-label="Previous week"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <WeekPicker weekStart={weekStart} onChange={navigate} />
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => navigate(addDays(weekStart, 7))}
          aria-label="Next week"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* The WeekPicker button already shows "W{n} · range", so no separate
          interval label here — it read as a duplicated week label. */}
      {weekStart !== currentWeek && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(currentWeek)}
          className="text-xs text-gray-500"
        >
          Today
        </Button>
      )}
    </div>
  )
}
