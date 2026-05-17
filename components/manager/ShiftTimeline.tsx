"use client"

import { useState, useMemo } from "react"
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core"
import { Plus } from "lucide-react"
import { cn, getInitials } from "@/lib/utils"
import { Tooltip } from "@/components/ui/tooltip"
import { AddShiftDialog } from "@/components/manager/AddShiftDialog"
import { EditShiftDialog } from "@/components/manager/EditShiftDialog"
import { SickDayDialog } from "@/components/manager/SickDayDialog"
import type { Shift, Employee, JobRole, ShiftTemplate } from "@/types"
import { formatTime } from "@/lib/dateUtils"

const DEFAULT_START_HOUR = 6
const DEFAULT_END_HOUR = 23

const COLOR_BAR: Record<string, string> = {
  blue:   "bg-blue-400 hover:bg-blue-500",
  green:  "bg-green-400 hover:bg-green-500",
  orange: "bg-orange-400 hover:bg-orange-500",
  purple: "bg-purple-400 hover:bg-purple-500",
  yellow: "bg-yellow-400 hover:bg-yellow-500",
  rose:   "bg-rose-400 hover:bg-rose-500",
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
  gray:   "text-gray-950",
  sick:   "text-rose-900",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function nowPercent(startHour: number, totalMinutes: number): number {
  const now = new Date()
  return ((now.getHours() * 60 + now.getMinutes() - startHour * 60) / totalMinutes) * 100
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]
}

// ── Employee chip (draggable) ─────────────────────────────────────────────────

interface ChipProps {
  employee: Employee
  missing: number
  over: number
  isOverlay?: boolean
}

function EmployeeChip({ employee, missing, over, isOverlay = false }: ChipProps) {
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

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 select-none shadow-sm transition-all shrink-0 cursor-grab active:cursor-grabbing",
        isDragging && !isOverlay && "opacity-40 scale-95",
        isOverlay && "rotate-1 shadow-xl scale-105"
      )}
    >
      <div className="size-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{getInitials(employee.name)}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-tight truncate text-gray-900 dark:text-gray-100">{employee.name}</p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight truncate">{employee.jobRole}</p>
      </div>
      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0", badgeClass)}>
        {badgeLabel}
      </span>
    </div>
  )
}

// ── Timeline row ──────────────────────────────────────────────────────────────

interface RowProps {
  employee: Employee
  date: string
  shifts: Shift[]
  jobRoles: JobRole[]
  publishedAt?: string | null
  isEven: boolean
  draggingEmpScheduledHere: boolean | null
  todayLine: number | null
  startHour: number
  endHour: number
  totalMinutes: number
  hourMarkers: number[]
  hoverSnap: { time: string; pct: number } | null
  onShiftClick: (shift: Shift) => void
  onRowClick: (employeeId: string, date: string) => void
}

function TimelineRow({
  employee, date, shifts, jobRoles, publishedAt, isEven,
  draggingEmpScheduledHere, todayLine,
  startHour, endHour, totalMinutes, hourMarkers,
  hoverSnap, onShiftClick, onRowClick,
}: RowProps) {
  const isEmpty = shifts.length === 0
  const canDrop = draggingEmpScheduledHere === false

  const { setNodeRef, isOver } = useDroppable({
    id: `row-${employee.id}--${date}`,
    data: { type: "row", employeeId: employee.id, date },
  })

  return (
    <div className={cn("flex border-b border-gray-200 dark:border-gray-700", isEven ? "bg-white dark:bg-gray-900" : "bg-gray-50/60 dark:bg-gray-800/40")}>
      {/* Name column */}
      <div className="w-44 shrink-0 border-r border-gray-200 dark:border-gray-700 px-3 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{employee.name}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{employee.jobRole}</p>
        </div>
        {isEmpty && (
          <Tooltip content="Add shift" side="right">
            <button
              onClick={() => onRowClick(employee.id, date)}
              className="shrink-0 size-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-500 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900 hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center transition-colors ml-1"
              aria-label={`Add shift for ${employee.name}`}
            >
              <Plus className="size-3" />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Time bars */}
      <div
        ref={setNodeRef}
        className={cn(
          "relative flex-1 h-14 transition-colors",
          isOver && canDrop  && "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-inset ring-blue-300 dark:ring-blue-700",
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

        {shifts.map((shift) => {
          const isSick = shift.colorTag === "sick"
          const left  = toPercent(shift.startTime, startHour, totalMinutes)
          const width = isSick ? 100 - left : durationPercent(shift.startTime, shift.endTime, startHour, totalMinutes)

          const tag = isSick ? "sick" : (jobRoles.find((r) => r.name === employee.jobRole)?.color ?? "gray")
          const isPublished = !isSick && !!publishedAt && shift.createdAt <= publishedAt

          return (
            <button
              key={shift.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); onShiftClick(shift) }}
              className={cn(
                "absolute top-2 bottom-2 rounded-md px-2 flex items-center overflow-hidden shadow-sm transition-all",
                "border-2",
                isPublished ? "border-green-500/60" : "border-orange-400/60",
                COLOR_BAR[tag] ?? "bg-blue-400 hover:bg-blue-500"
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${employee.name} · ${shift.startTime}–${shift.endTime}`}
            >
              {!isSick && width > 6 && (
                <span className={cn("text-[10px] font-semibold truncate whitespace-nowrap", COLOR_TEXT[tag] ?? "text-blue-950")}>
                  {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
                </span>
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
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                    {hoverSnap.time}
                  </span>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700 px-2.5 py-1 rounded-full shadow-sm">
                  Drop to schedule
                </span>
              </div>
            )}
          </div>
        )}

        {isOver && draggingEmpScheduledHere && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-800 px-2.5 py-1 rounded-full shadow-sm">
              Already has a shift
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
  employees: Employee[]
  allShifts: Shift[]
  jobRoles: JobRole[]
  publishedAt?: string | null
  draggingEmp: Employee | null
  startHour: number
  endHour: number
  totalMinutes: number
  hourMarkers: number[]
  activeRowId: string | null
  hoverSnap: { time: string; pct: number } | null
  onShiftClick: (shift: Shift) => void
  onRowClick: (employeeId: string, date: string) => void
}

function DaySection({
  date, employees, allShifts, jobRoles, publishedAt, draggingEmp,
  startHour, endHour, totalMinutes, hourMarkers,
  activeRowId, hoverSnap, onShiftClick, onRowClick,
}: DaySectionProps) {
  const isToday = date === todayStr()
  const todayLine = isToday ? nowPercent(startHour, totalMinutes) : null
  const dayShifts = useMemo(() => allShifts.filter((s) => s.date === date), [allShifts, date])

  const dateObj = new Date(date + "T12:00:00")
  const dayLabel = dateObj.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "short", timeZone: "UTC",
  })

  return (
    <div>
      {/* Sticky day header — sticks within the scrollable container */}
      <div className={cn("sticky top-0 z-[8] border-b border-gray-200 dark:border-gray-700", isToday ? "bg-blue-50 dark:bg-blue-900/30" : "bg-gray-50 dark:bg-gray-800")}>
        {/* Date label */}
        <div className={cn("flex items-center gap-2 px-4 py-1.5 border-b", isToday ? "border-blue-100 dark:border-blue-800" : "border-gray-100 dark:border-gray-700")}>
          <span className={cn("text-xs font-semibold", isToday ? "text-blue-700 dark:text-blue-400" : "text-gray-600 dark:text-gray-400")}>
            {dayLabel}
          </span>
          {isToday && (
            <span className="text-[10px] font-bold px-1.5 py-px bg-blue-600 text-white rounded-full">
              Today
            </span>
          )}
        </div>

        {/* Time axis */}
        <div className="flex">
          <div className="w-44 shrink-0 border-r border-gray-200 dark:border-gray-700 px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Employee
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

      {/* Employee rows */}
      {employees.map((emp, idx) => {
        const rowId = `row-${emp.id}--${date}`
        return (
          <TimelineRow
            key={emp.id}
            employee={emp}
            date={date}
            shifts={dayShifts.filter((s) => s.employeeId === emp.id)}
            jobRoles={jobRoles}
            publishedAt={publishedAt}
            isEven={idx % 2 === 0}
            draggingEmpScheduledHere={
              draggingEmp ? dayShifts.some((s) => s.employeeId === draggingEmp.id) : null
            }
            todayLine={todayLine}
            startHour={startHour}
            endHour={endHour}
            totalMinutes={totalMinutes}
            hourMarkers={hourMarkers}
            hoverSnap={activeRowId === rowId ? hoverSnap : null}
            onShiftClick={onShiftClick}
            onRowClick={onRowClick}
          />
        )
      })}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface ShiftTimelineProps {
  dates: string[]
  employees: Employee[]
  shifts: Shift[]
  jobRoles: JobRole[]
  shiftTemplates: ShiftTemplate[]
  scheduledHoursMap: Record<string, number>
  publishedAt?: string | null
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
  }) => void
  onShiftUpdate: (data: Partial<Shift>) => void
  onShiftDelete: (shiftId: string) => void
}

export function ShiftTimeline({
  dates,
  employees,
  shifts,
  jobRoles,
  shiftTemplates,
  scheduledHoursMap,
  publishedAt,
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
  onShiftCreate,
  onShiftUpdate,
  onShiftDelete,
}: ShiftTimelineProps) {
  const [addDialog, setAddDialog] = useState<{
    open: boolean; employeeId: string; defaultStartTime: string; date: string
  }>({ open: false, employeeId: "", defaultStartTime: "09:00", date: dates[0] ?? "" })

  const [hoverSnap, setHoverSnap] = useState<{ time: string; pct: number } | null>(null)
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [editDialog, setEditDialog] = useState<{ open: boolean; shift: Shift | null }>({ open: false, shift: null })
  const [sickDialog, setSickDialog] = useState<{ open: boolean; shift: Shift | null }>({ open: false, shift: null })
  const [draggingEmp, setDraggingEmp] = useState<Employee | null>(null)

  const totalMinutes = (endHour - startHour) * 60
  const hourMarkers = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i).filter((h) => h % 2 === 0),
    [startHour, endHour]
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

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
      const alreadyScheduled = shifts.some(
        (s) => s.employeeId === drag.employee.id && s.date === targetDate
      )
      if (alreadyScheduled) return
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
        <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
            Drag to schedule · weekly hours
          </p>
          <div className="flex flex-wrap gap-2">
            {employees.map((emp) => {
              const scheduled = scheduledHoursMap[emp.id] ?? 0
              const contracted = emp.contractedHours
              return (
                <EmployeeChip
                  key={emp.id}
                  employee={emp}
                  missing={Math.max(0, contracted - scheduled)}
                  over={Math.max(0, scheduled - contracted)}
                />
              )
            })}
          </div>
        </div>

        {/* Day sections */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[560px]">
            {dates.map((date, i) => (
              <div key={date}>
                {i > 0 && <div className="h-3 bg-gray-100 dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700" />}
                <DaySection
                  date={date}
                  employees={employees}
                  allShifts={shifts}
                  jobRoles={jobRoles}
                  publishedAt={publishedAt}
                  draggingEmp={draggingEmp}
                  startHour={startHour}
                  endHour={endHour}
                  totalMinutes={totalMinutes}
                  hourMarkers={hourMarkers}
                  activeRowId={activeRowId}
                  hoverSnap={hoverSnap}
                  onShiftClick={(shift) => {
                    if (shift.colorTag === "sick") setSickDialog({ open: true, shift })
                    else setEditDialog({ open: true, shift })
                  }}
                  onRowClick={(empId, d) =>
                    setAddDialog({ open: true, employeeId: empId, defaultStartTime: "09:00", date: d })
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
        />
      )}

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
