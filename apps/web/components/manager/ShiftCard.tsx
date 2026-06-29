"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Shift, Employee, JobRole } from "@/types"
import { formatTime, calcNetHours } from "@/lib/dateUtils"
import { getOrgSettings } from "@/lib/orgSettings"

const COLOR_BG: Record<string, string> = {
  blue:   "bg-blue-100 dark:bg-blue-900/70",
  green:  "bg-green-100 dark:bg-green-900/70",
  orange: "bg-orange-100 dark:bg-orange-900/70",
  purple: "bg-purple-100 dark:bg-purple-900/70",
  yellow: "bg-yellow-100 dark:bg-yellow-900/70",
  rose:   "bg-rose-100 dark:bg-rose-900/70",
  gray:   "bg-gray-100 dark:bg-gray-800",
}

const COLOR_TEXT: Record<string, string> = {
  blue:   "text-blue-900 dark:text-blue-200",
  green:  "text-green-900 dark:text-green-200",
  orange: "text-orange-900 dark:text-orange-200",
  purple: "text-purple-900 dark:text-purple-200",
  yellow: "text-yellow-900 dark:text-yellow-200",
  rose:   "text-rose-900 dark:text-rose-200",
  gray:   "text-gray-700 dark:text-gray-300",
}

interface ShiftCardProps {
  shift: Shift
  employee: Employee
  jobRoles: JobRole[]
  publishedAt?: string | null
  onClick: () => void
}

export function ShiftCard({ shift, employee, jobRoles, publishedAt, onClick }: ShiftCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: shift.id,
    data: { shift },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  const tf = getOrgSettings().timeFormat
  const isSick = shift.colorTag === "sick"

  if (isSick) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        className={cn(
          "group relative rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 border-l-4 border-l-rose-400 dark:border-l-rose-600 pl-2.5 pr-2 py-1.5 text-xs cursor-grab active:cursor-grabbing select-none shadow-sm hover:shadow-md transition-shadow",
          isDragging && "opacity-50 shadow-lg z-50"
        )}
      >
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="size-3 text-rose-500 shrink-0" />
          <p className="font-semibold text-rose-600 dark:text-rose-300 leading-tight truncate">{employee.name}</p>
        </div>
        <p className="text-rose-400 dark:text-rose-400 leading-tight mt-0.5">Sick Day</p>
        {shift.startTime !== "00:00" && (
          <p className="text-rose-400 dark:text-rose-500 leading-tight">
            {formatTime(shift.startTime, tf)} – {formatTime(shift.endTime, tf)}
            {" · "}{calcNetHours(shift.startTime, shift.endTime, shift.breakMinutes)}
          </p>
        )}
      </div>
    )
  }

  const tag = jobRoles.find((r) => r.name === employee.jobRole)?.color ?? "gray"
  const bgClass   = COLOR_BG[tag]   ?? "bg-gray-100"
  const textClass = COLOR_TEXT[tag] ?? "text-gray-700"

  const isPublished = !!publishedAt && shift.createdAt <= publishedAt
  const borderClass = isPublished ? "border-l-green-500" : "border-l-orange-400"

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "group relative rounded-md border border-gray-200 dark:border-gray-700 pl-2.5 pr-2 py-1.5 text-xs cursor-grab active:cursor-grabbing select-none border-l-4 shadow-sm hover:shadow-md transition-shadow",
        borderClass,
        bgClass,
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      <p className={cn("font-semibold leading-tight truncate", textClass)}>{employee.name}</p>
      <p className={cn("truncate leading-tight mt-0.5 opacity-70", textClass)}>{shift.jobRole}</p>
      <p className={cn("leading-tight mt-0.5 opacity-60", textClass)}>
        {formatTime(shift.startTime, tf)} – {formatTime(shift.endTime, tf)}
        {" · "}{calcNetHours(shift.startTime, shift.endTime, shift.breakMinutes)}
      </p>
      {shift.breakMinutes > 0 && (
        <p className={cn("leading-tight opacity-50", textClass)}>{shift.breakMinutes}m break</p>
      )}
    </div>
  )
}
