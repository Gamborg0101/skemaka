"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Shift, Employee, JobRole } from "@/types"
import { formatTime, calcNetHours } from "@/lib/dateUtils"

interface ShiftCardProps {
  shift: Shift
  employee: Employee
  jobRoles: JobRole[]
  onClick: () => void
}

const COLOR_BORDER: Record<string, string> = {
  blue: "border-l-blue-500",
  green: "border-l-green-500",
  orange: "border-l-orange-500",
  purple: "border-l-purple-500",
  yellow: "border-l-yellow-400",
  rose: "border-l-rose-400",
  gray: "border-l-gray-400",
  sick: "border-l-rose-400",
}

const COLOR_BG: Record<string, string> = {
  blue: "bg-blue-100",
  green: "bg-green-100",
  orange: "bg-orange-100",
  purple: "bg-purple-100",
  yellow: "bg-yellow-100",
  rose: "bg-rose-100",
  gray: "bg-gray-100",
  sick: "bg-rose-50",
}

const COLOR_TEXT: Record<string, string> = {
  blue: "text-blue-900",
  green: "text-green-900",
  orange: "text-orange-900",
  purple: "text-purple-900",
  yellow: "text-yellow-900",
  rose: "text-rose-900",
  gray: "text-gray-700",
  sick: "text-rose-600",
}



export function ShiftCard({ shift, employee, jobRoles, onClick }: ShiftCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: shift.id,
    data: { shift },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

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
          "group relative rounded-md border border-rose-200 bg-rose-50 border-l-4 border-l-rose-400 pl-2.5 pr-2 py-1.5 text-xs cursor-grab active:cursor-grabbing select-none shadow-sm hover:shadow-md transition-shadow",
          isDragging && "opacity-50 shadow-lg z-50"
        )}
      >
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="size-3 text-rose-500 shrink-0" />
          <p className="font-semibold text-rose-600 leading-tight truncate">{employee.name}</p>
        </div>
        <p className="text-rose-400 leading-tight mt-0.5">Sick Day</p>
        {shift.startTime !== "00:00" && (
          <p className="text-rose-400 leading-tight">
            {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
            {" · "}{calcNetHours(shift.startTime, shift.endTime, shift.breakMinutes)}
          </p>
        )}
      </div>
    )
  }

  const tag = jobRoles.find((r) => r.name === employee.jobRole)?.color ?? "gray"
  const borderClass = COLOR_BORDER[tag] ?? "border-l-gray-400"
  const bgClass = COLOR_BG[tag] ?? "bg-gray-100"
  const textClass = COLOR_TEXT[tag] ?? "text-gray-700"

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
        "group relative rounded-md border border-gray-200 pl-2.5 pr-2 py-1.5 text-xs cursor-grab active:cursor-grabbing select-none border-l-4 shadow-sm hover:shadow-md transition-shadow",
        borderClass,
        bgClass,
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      <p className={cn("font-semibold leading-tight truncate", textClass)}>{employee.name}</p>
      <p className={cn("truncate leading-tight mt-0.5 opacity-70", textClass)}>{shift.jobRole}</p>
      <p className={cn("leading-tight mt-0.5 opacity-60", textClass)}>
        {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
        {" · "}{calcNetHours(shift.startTime, shift.endTime, shift.breakMinutes)}
      </p>
      {shift.breakMinutes > 0 && (
        <p className={cn("leading-tight opacity-50", textClass)}>{shift.breakMinutes}m break</p>
      )}
    </div>
  )
}
