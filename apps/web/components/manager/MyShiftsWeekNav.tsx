"use client"

import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WeekPicker } from "@/components/manager/WeekPicker"
import { addDays, getMondayOfWeek, getISOWeek } from "@/lib/dateUtils"

interface MyShiftsWeekNavProps {
  weekStart: string
  employeeParam?: string
}

function formatInterval(weekStart: string): string {
  const start = new Date(weekStart + "T12:00:00Z")
  const end = new Date(weekStart + "T12:00:00Z")
  end.setUTCDate(end.getUTCDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
  return `${fmt(start)} – ${fmt(end)}`
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

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
          {formatInterval(weekStart)}
        </span>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
          W{getISOWeek(weekStart)}
        </span>
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
    </div>
  )
}
