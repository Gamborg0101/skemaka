"use client"

import { useState, useMemo, useEffect, useRef, memo } from "react"
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core"
import { Plus, AlertTriangle, Moon } from "lucide-react"
import { cn, getInitials } from "@/lib/utils"
import { Tooltip } from "@/components/ui/tooltip"
import { AddShiftDialog } from "@/components/manager/AddShiftDialog"
import { EditShiftDialog } from "@/components/manager/EditShiftDialog"
import { SickDayDialog } from "@/components/manager/SickDayDialog"
import { CancelledShiftDialog } from "@/components/manager/CancelledShiftDialog"
import type { Shift, Employee, JobRole, ShiftTemplate } from "@/types"
import type { AvailabilityConflict } from "@/lib/useScheduleData"
import { formatTime, todayISO } from "@/lib/dateUtils"
import { getOrgSettings } from "@/lib/orgSettings"
import { shiftColorToken } from "@/lib/roleColors"
import { useLocale, useTranslations } from "next-intl"
import { LOCALE_TAGS, type Locale } from "@skemaka/i18n"

const DEFAULT_START_HOUR = 6
const DEFAULT_END_HOUR = 23
/** Width of the sticky name column (w-32 on mobile) — the hour grid is the rest. */
const NAME_COL_PX = 128

const COLOR_BAR: Record<string, string> = {
  blue:   "bg-blue-400 hover:bg-blue-500",
  green:  "bg-green-400 hover:bg-green-500",
  orange: "bg-orange-400 hover:bg-orange-500",
  purple: "bg-purple-400 hover:bg-purple-500",
  yellow: "bg-yellow-400 hover:bg-yellow-500",
  rose:   "bg-rose-400 hover:bg-rose-500",
  red:    "bg-red-400 hover:bg-red-500",
  pink:   "bg-pink-400 hover:bg-pink-500",
  indigo: "bg-indigo-400 hover:bg-indigo-500",
  teal:   "bg-teal-400 hover:bg-teal-500",
  cyan:   "bg-cyan-400 hover:bg-cyan-500",
  gray:   "bg-gray-400 hover:bg-gray-500",
  sick:   "bg-rose-300 hover:bg-rose-400",
}

const COLOR_TEXT: Record<string, string> = {
  blue:   "text-blue-950",
  green:  "text-green-950",
  orange: "text-orange-950",
  purple: "text-purple-950",
  yellow: "text-yellow-950",
  rose:   "text-rose-950",
  red:    "text-red-950",
  pink:   "text-pink-950",
  indigo: "text-indigo-950",
  teal:   "text-teal-950",
  cyan:   "text-cyan-950",
  gray:   "text-gray-950",
  sick:   "text-rose-900",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

/**
 * Copy for the amber conflict triangle is resolved inline at the call site
 * (see TimelineRow) rather than in a helper taking the translator.
 *
 * Passing `t` around needs it typed, and `ReturnType<typeof useTranslations>`
 * un-parameterised resolves to a union over every message key in the catalogue.
 * Once the manager namespace grew past ~150 keys TypeScript gave up with "Type
 * instantiation is excessively deep" — a compile error caused by adding
 * *translations*, which is very hard to attribute after the fact. Narrowing the
 * type instead trips contravariance, because next-intl's translator only
 * accepts its own literal keys.
 */

// Snap a pixel X position (within the time-bars strip) to the nearest 15-minute
// mark, returning an "HH:MM" string clamped to the visible [startHour, endHour].
function snapClientXToTime(
  clientX: number,
  rect: { left: number; width: number },
  startHour: number,
  endHour: number,
  totalMinutes: number,
): string {
  const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  const snapped = Math.round((fraction * totalMinutes) / 15) * 15
  let mins = startHour * 60 + snapped
  mins = Math.max(startHour * 60, Math.min(endHour * 60, mins))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

function toPercent(time: string, startHour: number, totalMinutes: number): number {
  const [h, m] = time.split(":").map(Number)
  return Math.max(0, Math.min(100, ((h * 60 + m - startHour * 60) / totalMinutes) * 100))
}

function durationPercent(start: string, end: string, startHour: number, totalMinutes: number): number {
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  return Math.max(0, Math.min(100 - toPercent(start, startHour, totalMinutes), (mins / totalMinutes) * 100))
}

function nowPercent(now: Date, startHour: number, totalMinutes: number): number {
  return ((now.getHours() * 60 + now.getMinutes() - startHour * 60) / totalMinutes) * 100
}

// Deliberately not toISOString() — that yields the UTC date, so anywhere east
// of Greenwich the "Today" badge and the red now-line jumped to tomorrow during
// the evening while nowPercent() below kept using local hours.

// ── Employee chip (draggable) ─────────────────────────────────────────────────

interface ChipProps {
  employee: Employee
  missing: number
  over: number
  scheduled: number
  contracted: number
  isOverlay?: boolean
}

function EmployeeChip({ employee, missing, over, scheduled, contracted, isOverlay = false }: ChipProps) {
  const t = useTranslations("manager.schedule")
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip-${employee.id}`,
    data: { type: "chip", employee },
  })

  const badgeClass =
    over > 0
      ? "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300"
      : missing > 4
      ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
      : missing > 0
      ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"
      : "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"

  const badgeLabel =
    over > 0    ? `+${over.toFixed(0)}h`
    : missing > 0 ? `–${missing.toFixed(0)}h`
    : "✓"

  // Plain-language explanation of the badge — the "–18h" shorthand is meaningless
  // to a non-technical manager without it.
  const badgeTooltip =
    over > 0
      ? t("badgeOver", { scheduled: scheduled.toFixed(0), over: over.toFixed(0), contracted })
      : missing > 0
      ? t("badgeUnder", { scheduled: scheduled.toFixed(0), missing: missing.toFixed(0), contracted })
      : t("badgeMet", { scheduled: scheduled.toFixed(0), contracted })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        // touch-none: without it the browser claims the press as a scroll and
        // fires pointercancel, so the drag never starts on a phone.
        "flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-2 select-none touch-none shadow-sm transition-all shrink-0 cursor-grab active:cursor-grabbing",
        isDragging && !isOverlay && "opacity-40 scale-95",
        isOverlay && "rotate-1 shadow-xl scale-105"
      )}
    >
      <div className="size-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{getInitials(employee.name)}</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-xs font-semibold leading-tight truncate text-gray-900 dark:text-gray-100">{employee.name}</p>
          {!employee.userId && (
            <Tooltip content={t("emailUnconfirmed")} side="top">
              <span className="size-1.5 shrink-0 rounded-full bg-red-500 cursor-help" aria-label={t("emailUnconfirmed")} />
            </Tooltip>
          )}
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight truncate">{employee.jobRole}</p>
      </div>
      <Tooltip content={badgeTooltip} side="top">
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 cursor-help", badgeClass)}>
          {badgeLabel}
        </span>
      </Tooltip>
    </div>
  )
}

// ── Timeline row ──────────────────────────────────────────────────────────────

interface RowProps {
  employee: Employee
  date: string
  isClosed: boolean
  shifts: Shift[]
  jobRoles: JobRole[]
  isEven: boolean
  draggingEmpScheduledHere: boolean | null
  conflict: AvailabilityConflict | null
  todayLine: number | null
  startHour: number
  endHour: number
  totalMinutes: number
  hourMarkers: number[]
  hoverSnap: { time: string; pct: number } | null
  closedLabel: string
  onShiftClick: (shift: Shift) => void
  onRowClick: (employeeId: string, date: string) => void
  onShiftResize: (shiftId: string, startTime: string, endTime: string) => void
}

function TimelineRow({
  employee, date, isClosed, shifts, jobRoles, isEven, closedLabel,
  draggingEmpScheduledHere, conflict, todayLine,
  startHour, endHour, totalMinutes, hourMarkers,
  hoverSnap, onShiftClick, onRowClick, onShiftResize,
}: RowProps) {
  const t = useTranslations("manager.schedule")
  const isEmpty = shifts.length === 0
  const canDrop = !isClosed && draggingEmpScheduledHere === false
  const tf = getOrgSettings().timeFormat

  const { setNodeRef, isOver } = useDroppable({
    id: `row-${employee.id}--${date}`,
    data: { type: "row", employeeId: employee.id, date },
  })

  // The time-bars strip element — measured to convert pointer X → time when
  // resizing a shift by its edges. Combined with the droppable ref below.
  const barsRef = useRef<HTMLDivElement | null>(null)
  const setBarsRef = (node: HTMLDivElement | null) => {
    barsRef.current = node
    setNodeRef(node)
  }

  // Live edge-drag state: which shift/edge is being dragged and the previewed
  // times. Null when not resizing. Rendered optimistically; committed on release.
  const [resize, setResize] = useState<{
    shiftId: string; edge: "start" | "end"; startTime: string; endTime: string
  } | null>(null)

  const MIN_SHIFT_MINUTES = 15

  const startResize = (e: React.PointerEvent, shift: Shift, edge: "start" | "end") => {
    // Keep the click from bubbling to the bar (which would open the edit dialog)
    // and stop dnd-kit's pointer sensor from picking this up.
    e.preventDefault()
    e.stopPropagation()

    // Latest previewed times, tracked in a closure so `onUp` can commit them
    // without reading state inside a setState updater (which runs during render
    // and must stay side-effect free — calling onShiftResize there triggers a
    // "setState while rendering" error in the parent).
    let current = { startTime: shift.startTime, endTime: shift.endTime }
    setResize({ shiftId: shift.id, edge, startTime: current.startTime, endTime: current.endTime })

    const onMove = (ev: PointerEvent) => {
      const rect = barsRef.current?.getBoundingClientRect()
      if (!rect) return
      const t = snapClientXToTime(ev.clientX, rect, startHour, endHour, totalMinutes)
      let next = current
      if (edge === "start") {
        if (toMinutes(t) <= toMinutes(current.endTime) - MIN_SHIFT_MINUTES) next = { ...current, startTime: t }
      } else {
        if (toMinutes(t) >= toMinutes(current.startTime) + MIN_SHIFT_MINUTES) next = { ...current, endTime: t }
      }
      if (next === current) return
      current = next
      setResize((r) => (r ? { ...r, startTime: current.startTime, endTime: current.endTime } : r))
    }

    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      setResize(null)
      if (current.startTime !== shift.startTime || current.endTime !== shift.endTime) {
        onShiftResize(shift.id, current.startTime, current.endTime)
      }
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  // `relative z-0` makes the row its own stacking context, so the sticky name
  // column below can outrank the red now-line (which would otherwise paint
  // across the employee names) without also outranking the sticky day header,
  // which sits at z-8 in the parent.
  return (
    <div className={cn("relative z-0 flex border-b border-gray-200 dark:border-gray-700", isEven ? "bg-white dark:bg-gray-900" : "bg-gray-50/60 dark:bg-gray-800/40")}>
      {/* Name column — sticky so names stay readable while the hours axis is
          scrolled horizontally, which on a phone it always is. Matches the
          treatment WeeklyScheduleGrid already gives its own name column. */}
      <div className={cn(
        "sticky left-0 z-30 w-32 sm:w-44 shrink-0 border-r border-gray-200 dark:border-gray-700 px-3 py-3 flex items-center justify-between",
        isEven ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800",
      )}>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{employee.name}</p>
            {!employee.userId && (
              <Tooltip content={t("emailUnconfirmed")} side="right">
                <span className="size-1.5 shrink-0 rounded-full bg-red-500 cursor-help" aria-label={t("emailUnconfirmed")} />
              </Tooltip>
            )}
            {conflict && !isEmpty && (
              <Tooltip
                content={
                  conflict.type === "timeoff" ? t("conflictTimeoff")
                  : conflict.type === "unavailable" ? t("conflictUnavailable")
                  : conflict.type === "rest" ? t("conflictRest", { hours: conflict.hours })
                  : t("conflictLongDay", { hours: conflict.hours })
                }
                side="right"
              >
                <AlertTriangle className="size-3 shrink-0 text-amber-500 cursor-help" aria-label={t("availabilityConflict")} />
              </Tooltip>
            )}
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{employee.jobRole}</p>
        </div>
        {isEmpty && !isClosed && (
          <Tooltip content={t("addShift")} side="right">
            <button
              onClick={() => onRowClick(employee.id, date)}
              className="shrink-0 size-8 sm:size-5 rounded-full bg-blue-100 dark:bg-gray-700/60 text-blue-500 dark:text-gray-300 hover:bg-blue-200 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-gray-100 flex items-center justify-center transition-colors ml-1"
              aria-label={t("addShiftFor", { name: employee.name })}
            >
              <Plus className="size-4 sm:size-3" />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Time bars */}
      <div
        ref={setBarsRef}
        className={cn(
          "relative flex-1 h-14 transition-colors",
          isClosed && "bg-gray-50 dark:bg-gray-800/30",
          isOver && canDrop  && "bg-blue-50 dark:bg-gray-700/25 ring-1 ring-inset ring-blue-300 dark:ring-gray-600",
          isOver && !canDrop && draggingEmpScheduledHere && "bg-red-50 dark:bg-red-900/30 ring-1 ring-inset ring-red-200 dark:ring-red-800",
        )}
      >
        {hourMarkers.map((hour) => (
          <div
            key={hour}
            className="absolute top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700"
            style={{ left: `${((hour - startHour) / (endHour - startHour)) * 100}%` }}
          />
        ))}

        {todayLine !== null && todayLine >= 0 && todayLine <= 100 && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10" style={{ left: `${todayLine}%` }} />
        )}

        {isEmpty && canDrop && !isOver && (
          <div className="absolute inset-x-2 inset-y-2.5 rounded-md border border-dashed border-gray-300 dark:border-gray-600 pointer-events-none" />
        )}

        {isClosed && isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] font-medium uppercase tracking-widest text-gray-300 dark:text-gray-600 select-none">
              {closedLabel}
            </span>
          </div>
        )}

        {shifts.map((shift) => {
          const isSick = shift.colorTag === "sick"
          const isCancelled = !!shift.cancelledAt
          // While dragging an edge, render the previewed times optimistically.
          const r = resize?.shiftId === shift.id ? resize : null
          const startTime = r ? r.startTime : shift.startTime
          const endTime = r ? r.endTime : shift.endTime
          // Sick markers always span the whole day regardless of the hours
          // recorded on them, so pin them to the left edge at full width.
          const left  = isSick ? 0 : toPercent(startTime, startHour, totalMinutes)
          const width = isSick ? 100 : durationPercent(startTime, endTime, startHour, totalMinutes)

          const tag = shiftColorToken(shift, employee.jobRole, jobRoles)
          // Draft = private placeholder not yet rolled out; dashed orange outline.
          const isDraft = !isSick && !shift.publishedAt
          // Sick markers span the whole day and aren't time-bounded, and
          // cancelled shifts are a read-only record — neither gets resize grips.
          const canResize = !isSick && !isCancelled

          return (
            <button
              key={shift.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); onShiftClick(shift) }}
              className={cn(
                // px-3.5 keeps the time label clear of the edge resize grips.
                "group absolute top-2 bottom-2 rounded-md px-3.5 flex items-center overflow-hidden shadow-sm transition-[background-color,box-shadow]",
                "border-2",
                isCancelled
                  ? "border-gray-300/80 dark:border-gray-600/80 bg-gray-100 dark:bg-gray-800 opacity-70 hover:opacity-100"
                  : cn(
                      isDraft ? "border-dashed border-orange-400/80" : "border-green-500/60",
                      COLOR_BAR[tag] ?? "bg-blue-400 hover:bg-blue-500"
                    )
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={isCancelled ? t("cancelledTitle", { name: employee.name }) : t("shiftTitle", { name: employee.name, start: startTime, end: endTime })}
            >
              {!isSick && width > 6 && (
                <span className={cn(
                  "text-[10px] font-semibold truncate whitespace-nowrap",
                  isCancelled ? "text-gray-400 dark:text-gray-500 line-through" : (COLOR_TEXT[tag] ?? "text-blue-950")
                )}>
                  {formatTime(startTime, tf)}–{formatTime(endTime, tf)}
                </span>
              )}

              {canResize && (
                <>
                  {/* Left / right edge grips — drag to change start / end time.
                      Always visible white pills so they read as draggable; the
                      surrounding span is a wider hit area for easier grabbing. */}
                  <span
                    onPointerDown={(e) => startResize(e, shift, "start")}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-y-0 left-0 w-3 cursor-ew-resize flex items-center justify-center touch-none"
                    aria-label={t("dragStartHandle")}
                  >
                    <span className="h-5 w-1 rounded-full bg-white/50 group-hover:bg-white/90 shadow-sm ring-1 ring-black/5 group-hover:h-6 transition-all" />
                  </span>
                  <span
                    onPointerDown={(e) => startResize(e, shift, "end")}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-y-0 right-0 w-3 cursor-ew-resize flex items-center justify-center touch-none"
                    aria-label={t("dragEndHandle")}
                  >
                    <span className="h-5 w-1 rounded-full bg-white/50 group-hover:bg-white/90 shadow-sm ring-1 ring-black/5 group-hover:h-6 transition-all" />
                  </span>
                </>
              )}
            </button>
          )
        })}

        {isOver && canDrop && (
          <div className="absolute inset-0 pointer-events-none">
            {hoverSnap ? (
              <>
                <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400" style={{ left: `${hoverSnap.pct}%` }} />
                <div className="absolute top-1 -translate-x-1/2" style={{ left: `${hoverSnap.pct}%` }}>
                  <span className="text-xs font-semibold text-blue-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-blue-300 dark:border-gray-600 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                    {hoverSnap.time}
                  </span>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-blue-700 dark:text-gray-200 bg-blue-100 dark:bg-gray-700/60 border border-blue-300 dark:border-gray-600 px-2.5 py-1 rounded-full shadow-sm">
                  {t("dropToSchedule")}
                </span>
              </div>
            )}
          </div>
        )}

        {isOver && draggingEmpScheduledHere && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-800 px-2.5 py-1 rounded-full shadow-sm">
              {t("alreadyHasShift")}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Day section (header + rows for one date) ──────────────────────────────────

interface DaySectionProps {
  date: string
  isClosed: boolean
  employees: Employee[]
  allShifts: Shift[]
  jobRoles: JobRole[]
  draggingEmp: Employee | null
  startHour: number
  endHour: number
  totalMinutes: number
  hourMarkers: number[]
  activeRowId: string | null
  hoverSnap: { time: string; pct: number } | null
  currentTime: Date
  localeTag: string
  labels: { employee: string; today: string; closed: string }
  getConflict?: (employeeId: string, date: string) => AvailabilityConflict | null
  onShiftClick: (shift: Shift) => void
  onRowClick: (employeeId: string, date: string) => void
  onShiftResize: (shiftId: string, startTime: string, endTime: string) => void
}

const DaySection = memo(function DaySection({
  date, isClosed, employees, allShifts, jobRoles, draggingEmp,
  startHour, endHour, totalMinutes, hourMarkers, localeTag, labels,
  activeRowId, hoverSnap, currentTime, getConflict, onShiftClick, onRowClick, onShiftResize,
}: DaySectionProps) {
  const isToday = date === todayISO()
  const todayLine = isToday ? nowPercent(currentTime, startHour, totalMinutes) : null
  const dayShifts = useMemo(() => allShifts.filter((s) => s.date === date), [allShifts, date])

  // A closed, empty day used to collapse to a single banner with NO employee
  // rows. When it was the only day in view — which it always is on mobile,
  // where dayCount is clamped to 1 — that left the roster strip above listing
  // every employee over a body containing nobody, which reads as "the data
  // failed to load", not "we're shut today". The rows always render now; the
  // per-row "Closed" watermark carries the message and canDrop blocks drops.
  const dateObj = new Date(date + "T12:00:00")
  const dayLabel = dateObj.toLocaleDateString(localeTag, {
    weekday: "long", day: "numeric", month: "short",
  })

  return (
    <div>
      {/* Sticky day header — sticks within the scrollable container */}
      <div className={cn("sticky top-0 z-[8] border-b border-gray-200 dark:border-gray-700", isToday ? "bg-blue-50 dark:bg-gray-700/30" : "bg-gray-50 dark:bg-gray-800")}>
        {/* Date label */}
        {/* sticky left-0 + w-fit: the date is the one thing that must stay
            readable while the hours axis is panned sideways on a phone. */}
        <div className={cn("sticky left-0 flex w-fit items-center gap-2 px-4 py-1.5 border-b", isToday ? "border-blue-100 dark:border-gray-600" : "border-gray-100 dark:border-gray-700")}>
          <span className={cn("text-xs font-semibold", isToday ? "text-blue-700 dark:text-gray-100" : "text-gray-600 dark:text-gray-400")}>
            {dayLabel}
          </span>
          {isToday && (
            <span className="text-[10px] font-bold px-1.5 py-px bg-blue-600 text-white rounded-full">
              {labels.today}
            </span>
          )}
          {isClosed && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-px bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-full uppercase tracking-wide">
              <Moon className="size-2.5" />
              {labels.closed}
            </span>
          )}
        </div>

        {/* Time axis */}
        <div className="flex">
          {/* Explicit background, not bg-inherit — the immediate parent has no
              background of its own, so bg-inherit resolved to transparent and
              the scrolling hour labels showed through this cell. */}
          <div className={cn(
            "sticky left-0 z-[9] w-32 sm:w-44 shrink-0 border-r border-gray-200 dark:border-gray-700 px-3 py-1.5",
            isToday ? "bg-blue-50 dark:bg-gray-700" : "bg-gray-50 dark:bg-gray-800",
          )}>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {labels.employee}
            </span>
          </div>
          <div className="relative flex-1 h-8">
            {hourMarkers.map((hour) => {
              const pct = ((hour - startHour) / (endHour - startHour)) * 100
              return (
                <div key={hour} className="absolute top-0 h-full flex items-end pb-1" style={{ left: `${pct}%` }}>
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 -translate-x-1/2 select-none">
                    {hour.toString().padStart(2, "0")}:00
                  </span>
                </div>
              )
            })}
            {todayLine !== null && todayLine >= 0 && todayLine <= 100 && (
              <div className="absolute top-0 bottom-0 w-px bg-red-400" style={{ left: `${todayLine}%` }} />
            )}
          </div>
        </div>
      </div>

      {employees.map((emp, idx) => {
        const rowId = `row-${emp.id}--${date}`
        return (
          <TimelineRow
            key={emp.id}
            employee={emp}
            date={date}
            isClosed={isClosed}
            shifts={dayShifts.filter((s) => s.employeeId === emp.id)}
            jobRoles={jobRoles}
            isEven={idx % 2 === 0}
            draggingEmpScheduledHere={
              draggingEmp ? dayShifts.some((s) => s.employeeId === draggingEmp.id && !s.cancelledAt) : null
            }
            conflict={getConflict?.(emp.id, date) ?? null}
            todayLine={todayLine}
            startHour={startHour}
            endHour={endHour}
            totalMinutes={totalMinutes}
            hourMarkers={hourMarkers}
            hoverSnap={activeRowId === rowId ? hoverSnap : null}
            closedLabel={labels.closed}
            onShiftClick={onShiftClick}
            onRowClick={onRowClick}
            onShiftResize={onShiftResize}
          />
        )
      })}
    </div>
  )
})

// ── Main ──────────────────────────────────────────────────────────────────────

interface ShiftTimelineProps {
  dates: string[]
  employees: Employee[]
  shifts: Shift[]
  jobRoles: JobRole[]
  shiftTemplates: ShiftTemplate[]
  scheduledHoursMap: Record<string, number>
  getConflict?: (employeeId: string, date: string) => AvailabilityConflict | null
  startHour?: number
  endHour?: number
  onShiftCreate: (data: {
    employeeId: string
    date: string
    startTime: string
    endTime: string
    breakMinutes: number
    jobRole: string
    notes: string | null
    colorTag: string | null
    notifyNow?: boolean
  }) => void
  onShiftUpdate: (data: Partial<Shift>) => void
  onShiftDelete: (shiftId: string) => void
  onShiftCancel: (shiftId: string) => void
}

export function ShiftTimeline({
  dates,
  employees,
  shifts,
  jobRoles,
  shiftTemplates,
  scheduledHoursMap,
  getConflict,
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
  onShiftCreate,
  onShiftUpdate,
  onShiftDelete,
  onShiftCancel,
}: ShiftTimelineProps) {
  const [addDialog, setAddDialog] = useState<{
    open: boolean; employeeId: string; defaultStartTime: string; date: string
  }>({ open: false, employeeId: "", defaultStartTime: "09:00", date: dates[0] ?? "" })

  const [hoverSnap, setHoverSnap] = useState<{ time: string; pct: number } | null>(null)
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [editDialog, setEditDialog] = useState<{ open: boolean; shift: Shift | null }>({ open: false, shift: null })
  const [sickDialog, setSickDialog] = useState<{ open: boolean; shift: Shift | null }>({ open: false, shift: null })
  const [cancelledDialog, setCancelledDialog] = useState<{ open: boolean; shift: Shift | null }>({ open: false, shift: null })
  const [draggingEmp, setDraggingEmp] = useState<Employee | null>(null)
  const [currentTime, setCurrentTime] = useState(() => new Date())

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const t = useTranslations("manager.schedule")
  const localeTag = LOCALE_TAGS[useLocale() as Locale]
  const dayLabels = useMemo(
    () => ({ employee: t("employee"), today: t("today"), closed: t("closed") }),
    [t],
  )

  // Update the current-time indicator every minute so it doesn't go stale.
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const totalMinutes = (endHour - startHour) * 60
  const hourMarkers = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i).filter((h) => h % 2 === 0),
    [startHour, endHour]
  )

  // Days the store is closed (no bookings allowed). `hours` is index 0=Mon…6=Sun;
  // convert each date's JS weekday (0=Sun) to that Monday-based index.
  const storeHours = getOrgSettings().hours
  const closedDates = new Set(
    dates.filter((d) => !storeHours[(new Date(d + "T12:00:00").getDay() + 6) % 7]?.isOpen)
  )

  // PointerSensor alone made dragging impossible on a phone: the chip strip and
  // the hours grid are both scroll containers, and a 5px pointer threshold loses
  // every gesture to the scroller before dnd-kit claims it. TouchSensor with a
  // press delay is the standard fix — hold to drag, swipe to scroll — and needs
  // `touch-none` on the draggable so the browser stops treating the press as a
  // pan. See EmployeeChip's className.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  // The hour grid is 560px wide inside a ~390px phone, and the axis starts a
  // couple of hours before opening — so the default (unscrolled) view was mostly
  // empty morning, with the dinner service that every shift actually falls in
  // sitting off the right edge with no hint it was there. Scroll to just before
  // the day's first shift so the schedule is the thing you see.
  const firstShiftHour = useMemo(() => {
    const onScreen = shifts.filter((s) => dates.includes(s.date) && !s.cancelledAt && s.colorTag !== "sick")
    if (onScreen.length === 0) return null
    return Math.min(...onScreen.map((s) => Number(s.startTime.slice(0, 2))))
  }, [shifts, dates])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || firstShiftHour === null) return
    // Only when the grid actually overflows — on a desktop it all fits and
    // scrolling would just look like a glitch.
    if (el.scrollWidth <= el.clientWidth) return
    const gridWidth = el.scrollWidth - NAME_COL_PX
    const target = ((firstShiftHour - 0.5 - startHour) / (endHour - startHour)) * gridWidth
    el.scrollLeft = Math.max(0, Math.min(target, el.scrollWidth - el.clientWidth))
  }, [firstShiftHour, startHour, endHour, dates])

  function snapTimeFromPointer(pointerX: number, rowRect: { left: number; width: number }): { time: string; pct: number } {
    const relX = pointerX - rowRect.left
    const fraction = Math.max(0, Math.min(1, relX / rowRect.width))
    const rawMinutes = fraction * totalMinutes
    const snappedMinutes = Math.round(rawMinutes / 15) * 15
    const totalMins = startHour * 60 + snappedMinutes
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    return {
      time: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
      pct: (snappedMinutes / totalMinutes) * 100,
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const d = event.active.data.current
    if (d?.type === "chip") setDraggingEmp(d.employee)
  }

  const handleDragMove = (event: DragMoveEvent) => {
    const drop = event.over?.data.current
    if (drop?.type !== "row" || !event.over) {
      setHoverSnap(null)
      setActiveRowId(null)
      return
    }
    const activatorX = (event.activatorEvent as PointerEvent).clientX
    const currentX = activatorX + event.delta.x
    setActiveRowId(event.over.id as string)
    setHoverSnap(snapTimeFromPointer(currentX, event.over.rect))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingEmp(null)
    setHoverSnap(null)
    setActiveRowId(null)
    const { active, over } = event
    if (!over) return
    const drag = active.data.current
    const drop = over.data.current
    if (drag?.type === "chip" && drop?.type === "row") {
      const targetDate = drop.date as string
      if (closedDates.has(targetDate)) return  // store closed that day — no booking
      // No longer refuses a second shift on the same day: split shifts (lunch
      // and again for dinner) are normal, so dropping onto an already-worked
      // day opens the dialog pre-filled at the drop time like any other. The
      // server rejects a genuine OVERLAP, which is a range check the drop
      // point alone cannot decide — the manager picks the end time next.
      const activatorX = (event.activatorEvent as PointerEvent).clientX
      const currentX = activatorX + event.delta.x
      const { time: defaultStartTime } = snapTimeFromPointer(currentX, over.rect)
      setAddDialog({ open: true, employeeId: drag.employee.id, defaultStartTime, date: targetDate })
    }
  }

  return (
    <DndContext
      id="timeline-dnd"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full">

        {/* Employee chips */}
        <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 sm:px-4 sm:py-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {t("dragHint")}
            </p>
            {/* Legend — explains the hours badge colours. Hidden on phones: it
                costs a whole row above the fold to explain colours the badges
                themselves already carry, on the screen where vertical space is
                scarcest. The per-badge tooltips still spell it out. */}
            <div className="hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-400 dark:text-gray-500">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-green-400" /> {t("legendHoursMet")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-amber-400" /> {t("legendUnderContract")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-orange-400" /> {t("legendOverContract")}
              </span>
            </div>
          </div>
          {/* One horizontally-scrolling row on a phone: nine wrapped chips took
              ~5 rows and pushed the timeline itself below the fold. Wraps
              normally from sm up, where there's width for it. */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 sm:flex-wrap sm:overflow-visible sm:pb-0 sm:mb-0">
            {employees.map((emp) => {
              const scheduled = scheduledHoursMap[emp.id] ?? 0
              const contracted = emp.contractedHours
              return (
                <EmployeeChip
                  key={emp.id}
                  employee={emp}
                  missing={Math.max(0, contracted - scheduled)}
                  over={Math.max(0, scheduled - contracted)}
                  scheduled={scheduled}
                  contracted={contracted}
                />
              )
            })}
          </div>
        </div>

        {/* Day sections — pb-20 keeps the last employee row clear of the fixed
            mobile bottom nav, which used to sit on top of it. */}
        <div ref={scrollRef} className="flex-1 overflow-auto pb-20 md:pb-0">
          <div className="min-w-[560px]">
            {dates.map((date, i) => (
              <div key={date}>
                {i > 0 && <div className="h-3 bg-gray-100 dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700" />}
                <DaySection
                  date={date}
                  isClosed={closedDates.has(date)}
                  employees={employees}
                  allShifts={shifts}
                  jobRoles={jobRoles}
                  draggingEmp={draggingEmp}
                  startHour={startHour}
                  endHour={endHour}
                  totalMinutes={totalMinutes}
                  hourMarkers={hourMarkers}
                  localeTag={localeTag}
                  labels={dayLabels}
                  activeRowId={activeRowId}
                  hoverSnap={hoverSnap}
                  currentTime={currentTime}
                  getConflict={getConflict}
                  onShiftClick={(shift) => {
                    if (shift.cancelledAt) setCancelledDialog({ open: true, shift })
                    else if (shift.colorTag === "sick") setSickDialog({ open: true, shift })
                    else setEditDialog({ open: true, shift })
                  }}
                  onRowClick={(empId, d) => {
                    if (closedDates.has(d)) return  // store closed — no booking
                    setAddDialog({ open: true, employeeId: empId, defaultStartTime: "09:00", date: d })
                  }}
                  onShiftResize={(shiftId, startTime, endTime) =>
                    onShiftUpdate({ id: shiftId, startTime, endTime })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingEmp && (
          <EmployeeChip
            employee={draggingEmp}
            missing={Math.max(0, draggingEmp.contractedHours - (scheduledHoursMap[draggingEmp.id] ?? 0))}
            over={Math.max(0, (scheduledHoursMap[draggingEmp.id] ?? 0) - draggingEmp.contractedHours)}
            scheduled={scheduledHoursMap[draggingEmp.id] ?? 0}
            contracted={draggingEmp.contractedHours}
            isOverlay
          />
        )}
      </DragOverlay>

      <AddShiftDialog
        open={addDialog.open}
        onOpenChange={(open) => setAddDialog((p) => ({ ...p, open }))}
        employees={employees}
        jobRoles={jobRoles}
        shiftTemplates={shiftTemplates}
        defaultEmployeeId={addDialog.employeeId}
        defaultDate={addDialog.date}
        defaultStartTime={addDialog.defaultStartTime}
        getConflict={getConflict}
        onShiftCreate={onShiftCreate}
      />

      {editDialog.shift && (
        <EditShiftDialog
          open={editDialog.open}
          onOpenChange={(open) => setEditDialog((p) => ({ ...p, open }))}
          shift={editDialog.shift}
          jobRoles={jobRoles}
          onShiftUpdate={onShiftUpdate}
          onShiftDelete={onShiftDelete}
          onShiftCancel={onShiftCancel}
        />
      )}

      {cancelledDialog.shift && (() => {
        const emp = employees.find((e) => e.id === cancelledDialog.shift!.employeeId)
        if (!emp) return null
        return (
          <CancelledShiftDialog
            open={cancelledDialog.open}
            onOpenChange={(open) => setCancelledDialog((p) => ({ ...p, open }))}
            shift={cancelledDialog.shift!}
            employee={emp}
            onDelete={onShiftDelete}
          />
        )
      })()}

      {sickDialog.shift && (() => {
        const emp = employees.find((e) => e.id === sickDialog.shift!.employeeId)
        if (!emp) return null
        return (
          <SickDayDialog
            open={sickDialog.open}
            onOpenChange={(open) => setSickDialog((p) => ({ ...p, open }))}
            shift={sickDialog.shift!}
            employee={emp}
            onDelete={onShiftDelete}
          />
        )
      })()}
    </DndContext>
  )
}
