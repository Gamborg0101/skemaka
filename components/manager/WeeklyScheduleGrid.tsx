"use client"

import React, { useState, useCallback } from "react"
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { useDroppable } from "@dnd-kit/core"
import { Plus, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { ShiftCard } from "@/components/manager/ShiftCard"
import { AddShiftDialog } from "@/components/manager/AddShiftDialog"
import { EditShiftDialog } from "@/components/manager/EditShiftDialog"
import { SickDayDialog } from "@/components/manager/SickDayDialog"
import type { Schedule, Shift, Employee, JobRole } from "@/types"

interface WeeklyScheduleGridProps {
  schedule: Schedule
  employees: Employee[]
  jobRoles: JobRole[]
  scheduledHoursMap: Record<string, number>
  onShiftMove: (shiftId: string, newDate: string, newEmployeeId: string) => void
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
  onMarkSick: (employeeId: string, date: string) => void
}

function getWeekDays(weekStart: string): Date[] {
  const start = new Date(weekStart)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function formatHeaderDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function toISODate(date: Date) {
  return date.toISOString().split("T")[0]
}

// ── Droppable cell ────────────────────────────────────────────────────────────

interface DroppableCellProps {
  cellId: string
  employeeId: string
  date: string
  shifts: Shift[]
  employee: Employee
  jobRoles: JobRole[]
  isWeekend: boolean
  onAddClick: (employeeId: string, date: string) => void
  onShiftClick: (shift: Shift) => void
  onMarkSick: (employeeId: string, date: string) => void
}

function DroppableCell({
  cellId,
  employeeId,
  date,
  shifts,
  employee,
  jobRoles,
  isWeekend,
  onAddClick,
  onShiftClick,
  onMarkSick,
}: DroppableCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: cellId })

  const isEmpty = shifts.length === 0

  return (
    <div
      ref={setNodeRef}
      onClick={() => onAddClick(employeeId, date)}
      className={cn(
        "group relative min-h-16 p-1.5 border-r border-b border-gray-200 cursor-pointer transition-colors",
        isOver
          ? "bg-blue-50"
          : isEmpty
          ? isWeekend ? "bg-amber-50/60 hover:bg-amber-50" : "bg-gray-50 hover:bg-gray-100"
          : isWeekend ? "bg-amber-50/40 hover:bg-amber-50/60" : "bg-white hover:bg-gray-50"
      )}
    >
      <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
        {shifts.map((shift) => (
          <ShiftCard
            key={shift.id}
            shift={shift}
            employee={employee}
            jobRoles={jobRoles}
            onClick={() => onShiftClick(shift)}
          />
        ))}
      </div>
      {/* Action buttons on hover */}
      {isEmpty ? (
        // Empty cell: show both add and sick-day icons
        <div className="absolute bottom-1 right-1 hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMarkSick(employeeId, date)
            }}
            className="size-5 rounded-full bg-rose-100 text-rose-500 hover:bg-rose-200 flex items-center justify-center"
            aria-label="Mark sick"
          >
            <AlertTriangle className="size-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddClick(employeeId, date)
            }}
            className="size-5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center"
            aria-label="Add shift"
          >
            <Plus className="size-3" />
          </button>
        </div>
      ) : (
        // Cell with shifts: only show add button
        <button
          onClick={(e) => {
            e.stopPropagation()
            onAddClick(employeeId, date)
          }}
          className="absolute bottom-1 right-1 size-5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
          aria-label="Add shift"
        >
          <Plus className="size-3" />
        </button>
      )}
    </div>
  )
}

// ── Main grid ─────────────────────────────────────────────────────────────────

export function WeeklyScheduleGrid({
  schedule,
  employees,
  jobRoles,
  scheduledHoursMap,
  onShiftMove,
  onShiftCreate,
  onShiftUpdate,
  onShiftDelete,
  onMarkSick,
}: WeeklyScheduleGridProps) {
  const [addDialog, setAddDialog] = useState<{
    open: boolean
    employeeId: string
    date: string
  }>({ open: false, employeeId: "", date: "" })

  const [editDialog, setEditDialog] = useState<{
    open: boolean
    shift: Shift | null
  }>({ open: false, shift: null })

  const [sickDialog, setSickDialog] = useState<{
    open: boolean
    shift: Shift | null
  }>({ open: false, shift: null })

  const [activeShift, setActiveShift] = useState<Shift | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const days = getWeekDays(schedule.weekStart)
  const shifts = schedule.shifts ?? []

  const getShiftsForCell = useCallback(
    (employeeId: string, date: string) =>
      shifts.filter((s) => s.employeeId === employeeId && s.date === date),
    [shifts]
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const draggedShift = activeShift
    setActiveShift(null)
    const { active, over } = event
    if (!over || !draggedShift) return

    const shiftId = active.id as string
    // over.id is "employeeId_date"
    const [newEmployeeId, newDate] = (over.id as string).split("__")
    if (!newEmployeeId || !newDate) return

    // Bail out if dropped back onto the same cell it came from
    if (draggedShift.employeeId === newEmployeeId && draggedShift.date === newDate) return

    onShiftMove(shiftId, newDate, newEmployeeId)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const shift = shifts.find((s) => s.id === (event.active.id as string))
    if (shift) setActiveShift(shift)
  }

  const openAddDialog = (employeeId: string, date: string) => {
    setAddDialog({ open: true, employeeId, date })
  }

  const openEditDialog = (shift: Shift) => {
    if (shift.colorTag === "sick") {
      setSickDialog({ open: true, shift })
    } else {
      setEditDialog({ open: true, shift })
    }
  }

  return (
    <>
      <DndContext
        id="weekly-schedule-dnd"
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto">
          <div
            className="grid"
            style={{ gridTemplateColumns: "180px repeat(7, minmax(120px, 1fr))" }}
          >
            {/* Header row */}
            <div className="sticky left-0 z-10 bg-gray-100 border-b border-r border-gray-200 px-3 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Employee
              </span>
            </div>
            {days.map((day, i) => {
              const isToday = toISODate(day) === toISODate(new Date())
              const isWeekend = i >= 5
              return (
                <div
                  key={i}
                  className={cn(
                    "border-b border-r border-gray-200 px-2 py-2.5 text-center",
                    isToday ? "bg-blue-100" : isWeekend ? "bg-amber-50" : "bg-gray-100"
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide",
                      isToday ? "text-blue-700" : isWeekend ? "text-amber-700" : "text-gray-600"
                    )}
                  >
                    {DAY_NAMES[i]}
                  </p>
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isToday ? "text-blue-800" : isWeekend ? "text-amber-800" : "text-gray-800"
                    )}
                  >
                    {formatHeaderDate(day)}
                  </p>
                </div>
              )
            })}

            {/* Employee rows */}
            {employees.map((employee) => (
              <React.Fragment key={employee.id}>
                {/* Employee name cell */}
                <div
                  className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-3 py-2 flex flex-col justify-center min-h-16"
                >
                  <p className="text-sm font-semibold text-gray-900 truncate">{employee.name}</p>
                  <p className="text-xs text-gray-500 truncate">{employee.jobRole}</p>
                  {(() => {
                    const scheduled = scheduledHoursMap[employee.id] ?? 0
                    const contracted = employee.contractedHours
                    if (contracted === 0) return null
                    const pct = contracted > 0 ? scheduled / contracted : 0
                    const colorClass =
                      pct >= 1
                        ? "text-green-600"
                        : pct >= 0.5
                        ? "text-amber-500"
                        : "text-red-500"
                    return (
                      <p className={`text-xs mt-0.5 ${colorClass}`}>
                        {scheduled.toFixed(1)}h / {contracted}h
                      </p>
                    )
                  })()}
                </div>

                {/* Day cells */}
                {days.map((day, di) => {
                  const date = toISODate(day)
                  const cellId = `${employee.id}__${date}`
                  const cellShifts = getShiftsForCell(employee.id, date)
                  return (
                    <DroppableCell
                      key={cellId}
                      cellId={cellId}
                      employeeId={employee.id}
                      date={date}
                      shifts={cellShifts}
                      employee={employee}
                      jobRoles={jobRoles}
                      isWeekend={di >= 5}
                      onAddClick={openAddDialog}
                      onShiftClick={openEditDialog}
                      onMarkSick={onMarkSick}
                    />
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeShift && (() => {
            const emp = employees.find((e) => e.id === activeShift.employeeId)
            if (!emp) return null
            return (
              <div className="rotate-1 opacity-90 shadow-xl">
                <ShiftCard
                  shift={activeShift}
                  employee={emp}
                  jobRoles={jobRoles}
                  onClick={() => {}}
                />
              </div>
            )
          })()}
        </DragOverlay>
      </DndContext>

      {/* Add Shift Dialog */}
      <AddShiftDialog
        open={addDialog.open}
        onOpenChange={(open) => setAddDialog((prev) => ({ ...prev, open }))}
        employees={employees}
        jobRoles={jobRoles}
        defaultEmployeeId={addDialog.employeeId}
        defaultDate={addDialog.date}
        onShiftCreate={onShiftCreate}
      />

      {/* Edit Shift Dialog */}
      {editDialog.shift && (
        <EditShiftDialog
          open={editDialog.open}
          onOpenChange={(open) => setEditDialog((prev) => ({ ...prev, open }))}
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
            onOpenChange={(open) => setSickDialog((prev) => ({ ...prev, open }))}
            shift={sickDialog.shift!}
            employee={emp}
            onDelete={onShiftDelete}
          />
        )
      })()}
    </>
  )
}
