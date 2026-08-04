"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { AlertTriangle, Ban } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Shift, Employee, JobRole } from "@/types"
import { formatTime, calcNetHours } from "@/lib/dateUtils"
import { getOrgSettings } from "@/lib/orgSettings"
import { shiftColorToken } from "@/lib/roleColors"
import { useTranslations } from "next-intl"

const COLOR_BG: Record<string, string> = {
  blue:   "bg-blue-100 dark:bg-blue-900/70",
  green:  "bg-green-100 dark:bg-green-900/70",
  orange: "bg-orange-100 dark:bg-orange-900/70",
  purple: "bg-purple-100 dark:bg-purple-900/70",
  yellow: "bg-yellow-100 dark:bg-yellow-900/70",
  rose:   "bg-rose-100 dark:bg-rose-900/70",
  red:    "bg-red-100 dark:bg-red-900/70",
  pink:   "bg-pink-100 dark:bg-pink-900/70",
  indigo: "bg-indigo-100 dark:bg-indigo-900/70",
  teal:   "bg-teal-100 dark:bg-teal-900/70",
  cyan:   "bg-cyan-100 dark:bg-cyan-900/70",
  gray:   "bg-gray-100 dark:bg-gray-800",
}

const COLOR_TEXT: Record<string, string> = {
  blue:   "text-blue-900 dark:text-blue-200",
  green:  "text-green-900 dark:text-green-200",
  orange: "text-orange-900 dark:text-orange-200",
  purple: "text-purple-900 dark:text-purple-200",
  yellow: "text-yellow-900 dark:text-yellow-200",
  rose:   "text-rose-900 dark:text-rose-200",
  red:    "text-red-900 dark:text-red-200",
  pink:   "text-pink-900 dark:text-pink-200",
  indigo: "text-indigo-900 dark:text-indigo-200",
  teal:   "text-teal-900 dark:text-teal-200",
  cyan:   "text-cyan-900 dark:text-cyan-200",
  gray:   "text-gray-700 dark:text-gray-300",
}

interface ShiftCardProps {
  shift: Shift
  employee: Employee
  jobRoles: JobRole[]
  onClick: () => void
}

export function ShiftCard({ shift, employee, jobRoles, onClick }: ShiftCardProps) {
  const isCancelled = !!shift.cancelledAt
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: shift.id,
    data: { shift },
    disabled: isCancelled,
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  const tf = getOrgSettings().timeFormat
  const t = useTranslations("manager.schedule")
  const isSick = shift.colorTag === "sick"

  if (isCancelled) {
    return (
      <div
        ref={setNodeRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        className="group relative rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 border-l-4 border-l-gray-300 dark:border-l-gray-600 pl-2.5 pr-2 py-1.5 text-xs cursor-pointer select-none opacity-70 hover:opacity-100 transition-opacity"
      >
        <div className="flex items-center gap-1.5">
          <Ban className="size-3 text-gray-400 shrink-0" />
          <p className="font-semibold text-gray-500 dark:text-gray-400 leading-tight truncate line-through">{employee.name}</p>
        </div>
        <p className="text-gray-400 dark:text-gray-500 leading-tight mt-0.5">Cancelled</p>
        <p className="text-gray-400 dark:text-gray-500 leading-tight line-through">
          {formatTime(shift.startTime, tf)} – {formatTime(shift.endTime, tf)}
        </p>
      </div>
    )
  }

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

  const tag = shiftColorToken(shift, employee.jobRole, jobRoles)
  const bgClass   = COLOR_BG[tag]   ?? "bg-gray-100"
  const textClass = COLOR_TEXT[tag] ?? "text-gray-700"

  // Draft = private placeholder not yet rolled out to the employee. Dashed
  // outline + orange accent + chip, matching the industry convention (Planday
  // draws drafts orange, When I Work stripes them).
  const isDraft = !shift.publishedAt
  const borderClass = isDraft ? "border-l-orange-400" : "border-l-green-500"

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
        "group relative rounded-md pl-2.5 pr-2 py-1.5 text-xs cursor-grab active:cursor-grabbing select-none border-l-4 shadow-sm hover:shadow-md transition-shadow",
        isDraft
          ? "border border-dashed border-orange-300 dark:border-orange-800"
          : "border border-gray-200 dark:border-gray-700",
        borderClass,
        bgClass,
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      {isDraft && (
        <span className="absolute top-1 right-1 rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide bg-orange-100 text-orange-600 dark:bg-orange-900/60 dark:text-orange-300 pointer-events-none select-none">
          Draft
        </span>
      )}
      <p className={cn("font-semibold leading-tight truncate", isDraft && "pr-8", textClass)}>{employee.name}</p>
      <p className={cn("truncate leading-tight mt-0.5 opacity-70", textClass)}>{shift.jobRole}</p>
      <p className={cn("leading-tight mt-0.5 opacity-60", textClass)}>
        {formatTime(shift.startTime, tf)} – {formatTime(shift.endTime, tf)}
        {" · "}{calcNetHours(shift.startTime, shift.endTime, shift.breakMinutes)}
      </p>
      {shift.breakMinutes > 0 && (
        <p className={cn("leading-tight opacity-50", textClass)}>{t("breakMinutes", { n: shift.breakMinutes })}</p>
      )}
    </div>
  )
}
