"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LaborCostTable } from "@/components/manager/LaborCostTable"
import { getMondayOfWeek, addDays } from "@/lib/dateUtils"
import { WeekPicker } from "@/components/manager/WeekPicker"
import { toast } from "sonner"
import type { WeeklyLaborCost } from "@/types"
import { Skeleton } from "@/components/ui/skeleton"
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
    <div className="flex flex-col h-full">
      {/* Desktop header */}
      <div className="hidden md:flex items-center justify-between gap-3 px-6 py-3 border-b border-gray-200 bg-white shrink-0">
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
      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between gap-2 px-4 pt-6 pb-2 flex-wrap">
        <h1 className="text-lg font-semibold text-gray-900">Labor Cost</h1>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(getMondayOfWeek(new Date()))} disabled={isCurrentWeek}>Today</Button>
          <Button variant="outline" size="icon-sm" onClick={() => navigateWeek(-1)} aria-label="Previous week"><ChevronLeft className="size-4" /></Button>
          <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
          <Button variant="outline" size="icon-sm" onClick={() => navigateWeek(1)} aria-label="Next week"><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 md:px-6 py-6 pb-20 md:pb-6">
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white px-4 py-4">
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-7 w-20" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 grid grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-16" />
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`px-4 py-3 grid grid-cols-5 gap-4 border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50" : "bg-white"}`}>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <LaborCostTable costs={costs ?? empty} />
      )}
      </div>
    </div>
  )
}
