"use client"

import { useState } from "react"
import {
  DndContext,
  DragEndEvent,
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
import { AddShiftDialog } from "@/components/manager/AddShiftDialog"
import { EditShiftDialog } from "@/components/manager/EditShiftDialog"
import { SickDayDialog } from "@/components/manager/SickDayDialog"
import type { Shift, Employee, JobRole } from "@/types"
import { formatTime } from "@/lib/dateUtils"

// ── Time range defaults (overridden by props derived from OrgSettings) ────────

const DEFAULT_START_HOUR = 6
const DEFAULT_END_HOUR = 23

// ── Color maps ────────────────────────────────────────────────────────────────

const COLOR_BAR: Record<string, string> = {
  blue: "bg-blue-400 hover:bg-blue-500",
  green: "bg-green-400 hover:bg-green-500",
  orange: "bg-orange-400 hover:bg-orange-500",
  purple: "bg-purple-400 hover:bg-purple-500",
  yellow: "bg-yellow-400 hover:bg-yellow-500",
  rose: "bg-rose-400 hover:bg-rose-500",
  gray: "bg-gray-400 hover:bg-gray-500",
  sick: "bg-rose-300 hover:bg-rose-400",
}

const COLOR_TEXT: Record<string, string> = {
  blue: "text-blue-950",
  green: "text-green-950",
  orange: "text-orange-950",
  purple: "text-purple-950",
  yellow: "text-yellow-950",
  rose: "text-rose-950",
  gray: "text-gray-950",
  sick: "text-rose-900",
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

function isToday(d: string): boolean {
  return d === new Date().toISOString().split("T")[0]
}

// ── Employee chip (draggable) ─────────────────────────────────────────────────

interface ChipProps {
  employee: Employee
  missing: number
  isOverlay?: boolean
}

function EmployeeChip({ employee, missing, isOverlay = false }: ChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip-${employee.id}`,
    data: { type: "chip", employee },
  })

  const badgeClass =
    missing > 4
      ? "bg-red-100 text-red-700"
      : missing > 0
      ? "bg-amber-100 text-amber-700"
      : "bg-green-100 text-green-700"

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 cursor-grab active:cursor-grabbing select-none shadow-sm transition-all shrink-0",
        isDragging && !isOverlay && "opacity-40 scale-95",
        isOverlay && "rotate-1 shadow-xl scale-105"
      )}
    >
      <div className="size-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-gray-600">{getInitials(employee.name)}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-900 leading-tight truncate">{employee.name}</p>
        <p className="text-[10px] text-gray-500 leading-tight truncate">{employee.jobRole}</p>
      </div>
      {employee.contractedHours > 0 && (
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0", badgeClass)}>
          {missing > 0 ? `–${missing.toFixed(0)}h` : "✓"}
        </span>
      )}
    </div>
  )
}

// ── Droppable timeline row ────────────────────────────────────────────────────

interface RowProps {
  employee: Employee
  shifts: Shift[]
  jobRoles: JobRole[]
  isEven: boolean
  todayLine: number | null
  startHour: number
  endHour: number
  totalMinutes: number
  hourMarkers: number[]
  onShiftClick: (shift: Shift) => void
  onRowClick: (employeeId: string) => void
}

function TimelineRow({ employee, shifts, jobRoles, isEven, todayLine, startHour, endHour, totalMinutes, hourMarkers, onShiftClick, onRowClick }: RowProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `row-${employee.id}`,
    data: { type: "row", employeeId: employee.id },
  })

  return (
    <div className={cn("flex border-b border-gray-200", isEven ? "bg-white" : "bg-gray-50")}>
      {/* Name column */}
      <div className="w-36 shrink-0 border-r border-gray-200 px-3 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-900 truncate">{employee.name}</p>
          <p className="text-[10px] text-gray-500 truncate">{employee.jobRole}</p>
        </div>
        <button
          onClick={() => onRowClick(employee.id)}
          className="shrink-0 size-5 rounded-full bg-blue-100 text-blue-500 hover:bg-blue-200 hover:text-blue-700 flex items-center justify-center transition-colors ml-1"
          aria-label={`Add shift for ${employee.name}`}
        >
          <Plus className="size-3" />
        </button>
      </div>

      {/* Time bars */}
      <div
        ref={setNodeRef}
        className={cn(
          "relative flex-1 h-14 transition-colors",
          isOver ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : ""
        )}
      >
        {/* Vertical hour lines */}
        {hourMarkers.map((hour) => (
          <div
            key={hour}
            className="absolute top-0 bottom-0 w-px bg-gray-200"
            style={{ left: `${((hour - startHour) / (endHour - startHour)) * 100}%` }}
          />
        ))}

        {/* Now line */}
        {todayLine !== null && todayLine >= 0 && todayLine <= 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
            style={{ left: `${todayLine}%` }}
          />
        )}

        {/* Shift bars */}
        {shifts.map((shift) => {
          const isSick = shift.colorTag === "sick"
          const left = toPercent(shift.startTime, startHour, totalMinutes)
          const width = isSick ? 100 - left : durationPercent(shift.startTime, shift.endTime, startHour, totalMinutes)
          const tag = isSick ? "sick" : (jobRoles.find((r) => r.name === employee.jobRole)?.color ?? "gray")

          return (
            <button
              key={shift.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onShiftClick(shift)
              }}
              className={cn(
                "absolute top-2 bottom-2 rounded-md px-2 flex items-center overflow-hidden border border-white/40 shadow-sm transition-all",
                COLOR_BAR[tag] ?? "bg-blue-400 hover:bg-blue-500"
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${employee.name} · ${shift.startTime}–${shift.endTime}`}
            >
              {!isSick && width > 6 && (
                <span
                  className={cn(
                    "text-[10px] font-semibold truncate whitespace-nowrap",
                    COLOR_TEXT[tag] ?? "text-blue-950"
                  )}
                >
                  {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
                </span>
              )}
            </button>
          )
        })}

        {/* Drop hint overlay */}
        {isOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-semibold text-blue-700 bg-blue-100 border border-blue-300 px-2.5 py-1 rounded-full shadow-sm">
              Drop to schedule
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface ShiftTimelineProps {
  date: string
  employees: Employee[]
  shifts: Shift[]
  jobRoles: JobRole[]
  scheduledHoursMap: Record<string, number>
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
  date,
  employees,
  shifts,
  jobRoles,
  scheduledHoursMap,
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
  onShiftCreate,
  onShiftUpdate,
  onShiftDelete,
}: ShiftTimelineProps) {
  const [addDialog, setAddDialog] = useState<{ open: boolean; employeeId: string }>({
    open: false,
    employeeId: "",
  })
  const [editDialog, setEditDialog] = useState<{ open: boolean; shift: Shift | null }>({
    open: false,
    shift: null,
  })
  const [sickDialog, setSickDialog] = useState<{ open: boolean; shift: Shift | null }>({
    open: false,
    shift: null,
  })
  const [draggingEmp, setDraggingEmp] = useState<Employee | null>(null)

  const totalMinutes = (endHour - startHour) * 60
  const hourMarkers = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i
  ).filter((h) => h % 2 === 0)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const dayShifts = shifts.filter((s) => s.date === date)
  const today = isToday(date)
  const todayLine = today ? nowPercent(startHour, totalMinutes) : null

  const handleDragStart = (event: DragStartEvent) => {
    const d = event.active.data.current
    if (d?.type === "chip") setDraggingEmp(d.employee)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingEmp(null)
    const { active, over } = event
    if (!over) return
    const drag = active.data.current
    const drop = over.data.current
    if (drag?.type === "chip" && drop?.type === "row") {
      setAddDialog({ open: true, employeeId: drag.employee.id })
    }
  }

  return (
    <DndContext id="timeline-dnd" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full">

        {/* ── Employee chips panel ── */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
            Drag to schedule · weekly hours
          </p>
          <div className="flex flex-wrap gap-2">
            {employees.map((emp) => {
              const scheduled = scheduledHoursMap[emp.id] ?? 0
              const missing = Math.max(0, emp.contractedHours - scheduled)
              return <EmployeeChip key={emp.id} employee={emp} missing={missing} />
            })}
          </div>
        </div>

        {/* ── Timeline ── */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[560px]">
            {/* Time axis header */}
            <div className="flex border-b border-gray-200 bg-gray-100 sticky top-0 z-10">
              <div className="w-36 shrink-0 border-r border-gray-200 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                  Employee
                </span>
              </div>
              <div className="relative flex-1 h-9">
                {hourMarkers.map((hour) => {
                  const pct = ((hour - startHour) / (endHour - startHour)) * 100
                  return (
                    <div
                      key={hour}
                      className="absolute top-0 h-full flex items-end pb-1.5"
                      style={{ left: `${pct}%` }}
                    >
                      <span className="text-[10px] font-medium text-gray-500 -translate-x-1/2 select-none">
                        {hour.toString().padStart(2, "0")}:00
                      </span>
                    </div>
                  )
                })}
                {todayLine !== null && todayLine >= 0 && todayLine <= 100 && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-red-400"
                    style={{ left: `${todayLine}%` }}
                  />
                )}
              </div>
            </div>

            {/* Employee rows */}
            {employees.map((emp, idx) => (
              <TimelineRow
                key={emp.id}
                employee={emp}
                shifts={dayShifts.filter((s) => s.employeeId === emp.id)}
                jobRoles={jobRoles}
                isEven={idx % 2 === 0}
                todayLine={todayLine}
                startHour={startHour}
                endHour={endHour}
                totalMinutes={totalMinutes}
                hourMarkers={hourMarkers}
                onShiftClick={(shift) => {
                  if (shift.colorTag === "sick") {
                    setSickDialog({ open: true, shift })
                  } else {
                    setEditDialog({ open: true, shift })
                  }
                }}
                onRowClick={(empId) => setAddDialog({ open: true, employeeId: empId })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {draggingEmp && (
          <EmployeeChip
            employee={draggingEmp}
            missing={Math.max(0, draggingEmp.contractedHours - (scheduledHoursMap[draggingEmp.id] ?? 0))}
            isOverlay
          />
        )}
      </DragOverlay>

      {/* Add shift dialog */}
      <AddShiftDialog
        open={addDialog.open}
        onOpenChange={(open) => setAddDialog((p) => ({ ...p, open }))}
        employees={employees}
        jobRoles={jobRoles}
        defaultEmployeeId={addDialog.employeeId}
        defaultDate={date}
        onShiftCreate={onShiftCreate}
      />

      {/* Edit shift dialog */}
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

      {/* Sick Day Dialog */}
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
