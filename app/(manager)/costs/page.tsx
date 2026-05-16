"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LaborCostTable } from "@/components/manager/LaborCostTable"
import { getMondayOfWeek, addDays } from "@/lib/dateUtils"
import { WeekPicker } from "@/components/manager/WeekPicker"
import { toast } from "sonner"
import type { WeeklyLaborCost } from "@/types"
import { useOrg } from "@/lib/orgContext"

export default function CostsPage() {
  const { orgId } = useOrg()
  const [weekStart, setWeekStart] = useState<string>(getMondayOfWeek(new Date()))
  const [costs, setCosts] = useState<WeeklyLaborCost | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetch(`/api/orgs/${orgId}/costs?weekStart=${weekStart}`)
      .then((r) => r.json())
      .then((data: { data?: WeeklyLaborCost }) => {
        if (!cancelled && data.data) setCosts(data.data)
      })
      .catch(() => { if (!cancelled) toast.error("Failed to load costs") })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [weekStart, orgId])

  const navigateWeek = (direction: -1 | 1) => setWeekStart((ws) => addDays(ws, direction * 7))
  const isCurrentWeek = getMondayOfWeek(new Date()) === weekStart

  const empty: WeeklyLaborCost = { weekStart, totalHours: 0, totalCost: 0, entries: [] }

  return (
    <div className="px-4 md:px-6 py-6 pb-20 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Labor Cost</h1>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(getMondayOfWeek(new Date()))} disabled={isCurrentWeek} className="mr-1">
            Today
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => navigateWeek(-1)} aria-label="Previous week">
            <ChevronLeft className="size-4" />
          </Button>
          <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
          <Button variant="outline" size="icon-sm" onClick={() => navigateWeek(1)} aria-label="Next week">
            <ChevronRight className="size-4" />
          </Button>
          <div className="ml-2 border-l border-gray-200 pl-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!costs || loading}
              onClick={() => window.open(`/api/orgs/${orgId}/costs?weekStart=${weekStart}&format=csv`)}
            >
              <Download className="size-4 mr-1.5" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="size-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </div>
      ) : (
        <LaborCostTable costs={costs ?? empty} />
      )}
    </div>
  )
}
