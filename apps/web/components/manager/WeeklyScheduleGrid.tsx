"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
  useRef,
} from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { Plus, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { ShiftCard } from "@/components/manager/ShiftCard";
import { AddShiftDialog } from "@/components/manager/AddShiftDialog";
import { EditShiftDialog } from "@/components/manager/EditShiftDialog";
import { SickDayDialog } from "@/components/manager/SickDayDialog";
import { CancelledShiftDialog } from "@/components/manager/CancelledShiftDialog";
import type {
  Schedule,
  Shift,
  Employee,
  JobRole,
  ShiftTemplate,
  TimeOffRequest,
} from "@/types";
import type { AvailabilityConflict } from "@/lib/useScheduleData";
import type { CoverFocus } from "@/components/manager/CoverRequestsPanel";
import { getOrgSettings } from "@/lib/orgSettings";

interface WeeklyScheduleGridProps {
  schedule: Schedule;
  employees: Employee[];
  jobRoles: JobRole[];
  shiftTemplates: ShiftTemplate[];
  scheduledHoursMap: Record<string, number>;
  approvedTimeOff?: TimeOffRequest[];
  getConflict?: (employeeId: string, date: string) => AvailabilityConflict | null;
  coverFocus?: CoverFocus | null;
  publishedAt?: string | null;
  onShiftMove: (
    shiftId: string,
    newDate: string,
    newEmployeeId: string,
  ) => void;
  onShiftCreate: (data: {
    employeeId: string;
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    jobRole: string;
    notes: string | null;
    colorTag: string | null;
  }) => void;
  onShiftUpdate: (data: Partial<Shift>) => void;
  onShiftDelete: (shiftId: string) => void;
  onShiftCancel: (shiftId: string) => void;
  onMarkSick: (employeeId: string, date: string) => void;
}

const EMPLOYEE_COL_WIDTH = 160;

function getVisibleDays(containerWidth: number): 3 | 5 | 7 {
  if (containerWidth >= 1070) return 7; // 7 × 130 + 160
  if (containerWidth >= 810) return 5; // 5 × 130 + 160
  return 3;
}

function getWeekDays(weekStart: string): Date[] {
  // Pin to local noon to avoid DST-boundary shifts on UTC-N timezones where
  // midnight parsing could roll the date back by the UTC offset.
  const start = new Date(weekStart + "T12:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatHeaderDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function toISODate(date: Date) {
  return date.toISOString().split("T")[0];
}

// ── Droppable cell ────────────────────────────────────────────────────────────

interface DroppableCellProps {
  cellId: string;
  employeeId: string;
  date: string;
  shifts: Shift[];
  employee: Employee;
  jobRoles: JobRole[];
  publishedAt?: string | null;
  isWeekend: boolean;
  isClosed: boolean;
  isTimeOff: boolean;
  conflict: AvailabilityConflict | null;
  coverRole: "source" | "dest" | null;
  isToday: boolean;
  onAddClick: (employeeId: string, date: string) => void;
  onShiftClick: (shift: Shift) => void;
}

function DroppableCell({
  cellId,
  employeeId,
  date,
  shifts,
  employee,
  jobRoles,
  publishedAt,
  isWeekend,
  isClosed,
  isTimeOff,
  conflict,
  coverRole,
  isToday,
  onAddClick,
  onShiftClick,
}: DroppableCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: cellId });

  const isEmpty = shifts.length === 0;

  // Cover-request highlight ring + corner label (source = giving up, dest = would cover).
  const coverRing =
    coverRole === "source" ? "ring-2 ring-inset ring-amber-500 dark:ring-amber-400"
    : coverRole === "dest" ? "ring-2 ring-inset ring-green-500 dark:ring-green-400"
    : "";
  const coverBadge = coverRole && (
    <span
      className={cn(
        "absolute -top-px left-0 z-20 rounded-br-md px-1.5 py-0.5 text-[10px] font-bold text-white",
        coverRole === "source" ? "bg-amber-500" : "bg-green-600",
      )}
    >
      {coverRole === "source" ? "Giving up" : "Would cover"}
    </span>
  );

  // A day the employee said they can't work. Unlike time off (a hard block), the
  // manager can still schedule them here — so we mark it but keep the cell usable.
  // Rendered in-flow above any shift so it marks the day whether empty or filled.
  const isUnavailable = conflict?.type === "unavailable";
  const dayOffBadge = isUnavailable && (
    <span className="inline-block mb-1 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300 select-none">
      Day Off
    </span>
  );

  if (isClosed) {
    return (
      <div
        className={cn(
          "relative min-h-16 border-r border-b border-gray-200 dark:border-gray-700",
          isToday
            ? "bg-blue-50/60 dark:bg-gray-700/20"
            : "bg-gray-50/80 dark:bg-gray-800/80",
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-300 dark:text-gray-600 select-none">
            Closed
          </span>
        </div>
      </div>
    );
  }

  if (isTimeOff && isEmpty) {
    return (
      <div
        ref={setNodeRef}
        className={cn("relative min-h-16 border-r border-b border-gray-200 dark:border-gray-700 bg-rose-50/60 dark:bg-rose-950/30", coverRing)}
      >
        {coverBadge}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-rose-300 dark:text-rose-700 select-none">
            Time Off
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      onClick={isEmpty ? () => onAddClick(employeeId, date) : undefined}
      className={cn(
        "group relative min-h-16 p-1.5 border-r border-b border-gray-200 dark:border-gray-700 transition-colors",
        isEmpty ? "cursor-pointer" : "cursor-default",
        isOver
          ? "bg-blue-50 dark:bg-gray-700/25"
          : isEmpty
            ? isWeekend
              ? "bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              : isToday
                ? "bg-blue-50/40 dark:bg-gray-700/15 hover:bg-blue-50/70 dark:hover:bg-gray-700/25"
                : "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50"
            : isWeekend
              ? "bg-amber-50/40 dark:bg-amber-950/10"
              : isToday
                ? "bg-blue-50/20 dark:bg-gray-700/10"
                : "bg-white dark:bg-gray-900",
        coverRing,
      )}
    >
      {coverBadge}
      {dayOffBadge}
      {conflict?.type === "timeoff" && !isEmpty && (
        <Tooltip content="Scheduled during approved time off" side="top">
          <span className="absolute top-1 right-1 z-10 flex size-4 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/60 cursor-help">
            <AlertTriangle className="size-2.5 text-amber-600 dark:text-amber-300" />
          </span>
        </Tooltip>
      )}
      <div className="space-y-1">
        {shifts.map((shift) => (
          <ShiftCard
            key={shift.id}
            shift={shift}
            employee={employee}
            jobRoles={jobRoles}
            publishedAt={publishedAt}
            onClick={() => onShiftClick(shift)}
          />
        ))}
      </div>
      {/* Action button — only shown on empty cells. Sick day lives inside Add shift. */}
      {isEmpty && (
        <div className="absolute bottom-1 right-1 hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip content="Add shift" side="top">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddClick(employeeId, date);
              }}
              className="size-5 rounded-full bg-blue-100 dark:bg-gray-700/60 text-blue-600 dark:text-gray-300 hover:bg-blue-200 dark:hover:bg-gray-700 flex items-center justify-center"
              aria-label="Add shift"
            >
              <Plus className="size-3" />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

// ── Main grid ─────────────────────────────────────────────────────────────────

export function WeeklyScheduleGrid({
  schedule,
  employees,
  jobRoles,
  shiftTemplates,
  scheduledHoursMap,
  approvedTimeOff = [],
  getConflict,
  coverFocus,
  publishedAt,
  onShiftMove,
  onShiftCreate,
  onShiftUpdate,
  onShiftDelete,
  onShiftCancel,
  onMarkSick,
}: WeeklyScheduleGridProps) {
  const [addDialog, setAddDialog] = useState<{
    open: boolean;
    employeeId: string;
    date: string;
  }>({ open: false, employeeId: "", date: "" });

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    shift: Shift | null;
  }>({ open: false, shift: null });

  const [sickDialog, setSickDialog] = useState<{
    open: boolean;
    shift: Shift | null;
  }>({ open: false, shift: null });

  const [cancelledDialog, setCancelledDialog] = useState<{
    open: boolean;
    shift: Shift | null;
  }>({ open: false, shift: null });

  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [mobileDay, setMobileDay] = useState(0);
  const [startDayOffset, setStartDayOffset] = useState(0);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setContainerWidth(entry.contentRect.width),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visibleDays = getVisibleDays(containerWidth ?? 0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const days = getWeekDays(schedule.weekStart);

  // Sync selected mobile day to today when week changes; reset desktop offset to Monday.
  // Uses "adjust state during render" pattern — avoids setState in an effect.
  // Starts empty so the sync also runs on first render (the original effect ran on mount).
  const [prevWeekStart, setPrevWeekStart] = useState("");
  if (schedule.weekStart !== prevWeekStart) {
    setPrevWeekStart(schedule.weekStart);
    const todayISO = new Date().toISOString().split("T")[0];
    const idx = days.findIndex((d) => toISODate(d) === todayISO);
    setMobileDay(idx >= 0 ? idx : 0);
    setStartDayOffset(0);
  }

  // Clamp offset when the number of visible columns shrinks.
  // Uses "adjust state during render" pattern.
  const [prevVisibleDays, setPrevVisibleDays] = useState(visibleDays);
  if (visibleDays !== prevVisibleDays) {
    setPrevVisibleDays(visibleDays);
    setStartDayOffset((o) => Math.min(o, 7 - visibleDays));
  }

  const shifts = useMemo(() => schedule.shifts ?? [], [schedule.shifts]);
  const closedDays = getOrgSettings().hours.map((h) => !h.isOpen); // index 0=Mon…6=Sun

  const timeOffByEmployee = useMemo(() => {
    const map = new Map<string, { start: string; end: string }[]>();
    for (const r of approvedTimeOff) {
      if (!map.has(r.employeeId)) map.set(r.employeeId, []);
      map.get(r.employeeId)!.push({ start: r.startDate, end: r.endDate });
    }
    return map;
  }, [approvedTimeOff]);

  const isTimeOffDay = useCallback(
    (employeeId: string, date: string) => {
      const ranges = timeOffByEmployee.get(employeeId);
      if (!ranges) return false;
      return ranges.some((r) => date >= r.start && date <= r.end);
    },
    [timeOffByEmployee],
  );

  const shiftsByCell = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      const key = `${s.employeeId}__${s.date}`;
      const bucket = map.get(key) ?? [];
      bucket.push(s);
      map.set(key, bucket);
    }
    return map;
  }, [shifts]);

  const getShiftsForCell = useCallback(
    (employeeId: string, date: string) =>
      shiftsByCell.get(`${employeeId}__${date}`) ?? [],
    [shiftsByCell],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const draggedShift = activeShift;
    setActiveShift(null);
    const { active, over } = event;
    if (!over || !draggedShift) return;

    const shiftId = active.id as string;
    // over.id is "employeeId_date"
    const [newEmployeeId, newDate] = (over.id as string).split("__");
    if (!newEmployeeId || !newDate) return;

    // Bail out if dropped back onto the same cell it came from
    if (
      draggedShift.employeeId === newEmployeeId &&
      draggedShift.date === newDate
    )
      return;

    // Soft warning (not a block): the manager can move a shift onto a time-off /
    // unavailable day, but we flag it so it isn't done by accident. The cell keeps
    // a ⚠ badge afterward.
    if (isTimeOffDay(newEmployeeId, newDate)) {
      toast.warning("Heads up: this employee has approved time off that day");
    }

    onShiftMove(shiftId, newDate, newEmployeeId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const shift = shifts.find((s) => s.id === (event.active.id as string));
    if (shift) setActiveShift(shift);
  };

  const openAddDialog = (employeeId: string, date: string) => {
    setAddDialog({ open: true, employeeId, date });
  };

  const openEditDialog = (shift: Shift) => {
    if (shift.cancelledAt) {
      setCancelledDialog({ open: true, shift });
    } else if (shift.colorTag === "sick") {
      setSickDialog({ open: true, shift });
    } else {
      setEditDialog({ open: true, shift });
    }
  };

  return (
    <div ref={gridRef}>
      <DndContext
        id="weekly-schedule-dnd"
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* ── Mobile: day picker + employee list (hidden on md+) ── */}
        <div className="md:hidden flex flex-col">
          {/* Day pills */}
          <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex shrink-0">
            {days.map((day, i) => {
              const isToday = toISODate(day) === toISODate(new Date());
              const isWeekend = i >= 5;
              const isClosed = closedDays[i];
              const isSelected = mobileDay === i;
              return (
                <button
                  key={i}
                  onClick={() => setMobileDay(i)}
                  className={cn(
                    "flex-1 flex flex-col items-center py-2.5 border-b-2 transition-colors",
                    isSelected
                      ? "border-blue-600 dark:border-gray-400"
                      : "border-transparent",
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wide",
                      isClosed
                        ? "text-gray-300 dark:text-gray-600"
                        : isWeekend
                          ? "text-amber-500"
                          : isSelected
                            ? "text-blue-600 dark:text-slate-200"
                            : "text-gray-500 dark:text-gray-400",
                    )}
                  >
                    {DAY_NAMES[i]}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 size-6 flex items-center justify-center rounded-full text-xs font-bold",
                      isToday && isSelected && "bg-blue-600 text-white",
                      isToday &&
                        !isSelected &&
                        "ring-2 ring-blue-400 dark:ring-gray-400 text-blue-700 dark:text-gray-100",
                      !isToday &&
                        isSelected &&
                        "bg-blue-100 dark:bg-gray-700/60 text-blue-700 dark:text-gray-200",
                      !isToday &&
                        !isSelected &&
                        (isClosed
                          ? "text-gray-300 dark:text-gray-600"
                          : "text-gray-700 dark:text-gray-300"),
                    )}
                  >
                    {day.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Employee list for selected day */}
          <div className="divide-y divide-gray-100 dark:divide-gray-800 pb-20">
            {employees.map((employee) => {
              const date = toISODate(days[mobileDay]);
              const cellShifts = getShiftsForCell(employee.id, date);
              const isClosed = closedDays[mobileDay];
              const isTimeOff = isTimeOffDay(employee.id, date);
              const isUnavailable = getConflict?.(employee.id, date)?.type === "unavailable";
              const scheduled = scheduledHoursMap[employee.id] ?? 0;
              const contracted = employee.contractedHours;
              return (
                <div
                  key={employee.id}
                  className="bg-white dark:bg-gray-900 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-50 truncate">
                          {employee.name}
                        </p>
                        {!employee.userId && (
                          <Tooltip content="Has not confirmed their email yet" side="top">
                            <span className="size-1.5 shrink-0 rounded-full bg-red-500 cursor-help" aria-label="Has not confirmed their email yet" />
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {employee.jobRole}
                      </p>
                      {contracted > 0 &&
                        (() => {
                          const over = scheduled - contracted;
                          if (over > 0)
                            return (
                              <Tooltip
                                content={`${over.toFixed(1)}h over contracted hours this week`}
                                side="right"
                              >
                                <p className="text-xs mt-0.5 text-orange-500 cursor-default w-fit">
                                  {scheduled.toFixed(1)}h / {contracted}h
                                  <span className="ml-1 font-semibold">
                                    (+{over.toFixed(1)}h)
                                  </span>
                                </p>
                              </Tooltip>
                            );
                          const pct = scheduled / contracted;
                          const label =
                            pct >= 1
                              ? "Fully scheduled this week"
                              : `${Math.round(pct * 100)}% of contracted hours scheduled`;
                          return (
                            <Tooltip content={label} side="right">
                              <p
                                className={`text-xs mt-0.5 cursor-default w-fit ${pct >= 1 ? "text-green-600" : pct >= 0.5 ? "text-amber-500" : "text-red-500"}`}
                              >
                                {scheduled.toFixed(1)}h / {contracted}h
                              </p>
                            </Tooltip>
                          );
                        })()}
                    </div>
                    {!isClosed && !isTimeOff && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Tooltip content="Add shift" side="top">
                          <button
                            onClick={() => openAddDialog(employee.id, date)}
                            className="size-10 rounded-full bg-blue-50 dark:bg-gray-800/60 text-blue-600 hover:bg-blue-100 dark:hover:bg-gray-700/50 flex items-center justify-center transition-colors"
                            aria-label={`Add shift for ${employee.name}`}
                          >
                            <Plus className="size-4" />
                          </button>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                  {isClosed && (
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-gray-300 dark:text-gray-600">
                      Closed
                    </p>
                  )}
                  {isTimeOff && !isClosed && (
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-rose-300 dark:text-rose-600">
                      Time Off
                    </p>
                  )}
                  {isUnavailable && !isClosed && !isTimeOff && (
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-rose-400 dark:text-rose-500">
                      Day Off
                    </p>
                  )}
                  {cellShifts.length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      {cellShifts.map((shift) => (
                        <ShiftCard
                          key={shift.id}
                          shift={shift}
                          employee={employee}
                          jobRoles={jobRoles}
                          publishedAt={publishedAt}
                          onClick={() => openEditDialog(shift)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Desktop: responsive grid (hidden on mobile) ── */}
        <div className="hidden md:block">
          <div
            className="grid w-full"
            style={{
              gridTemplateColumns: `${EMPLOYEE_COL_WIDTH}px repeat(${visibleDays}, minmax(0, 1fr))`,
            }}
          >
            {/* Header row */}
            <div className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 px-3 py-2.5 flex items-center justify-between gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Employee
              </span>
              {visibleDays < 7 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setStartDayOffset((o) => Math.max(0, o - 1))}
                    disabled={startDayOffset === 0}
                    className="size-5 flex items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    aria-label="Previous days"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      setStartDayOffset((o) => Math.min(7 - visibleDays, o + 1))
                    }
                    disabled={startDayOffset + visibleDays >= 7}
                    className="size-5 flex items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    aria-label="Next days"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
            {days
              .slice(startDayOffset, startDayOffset + visibleDays)
              .map((day, si) => {
                const di = startDayOffset + si;
                const isToday = toISODate(day) === toISODate(new Date());
                const isWeekend = di >= 5;
                const isClosed = closedDays[di];
                return (
                  <div
                    key={di}
                    className={cn(
                      "border-b border-r border-gray-200 dark:border-gray-700 px-2 py-2.5 text-center",
                      isClosed
                        ? "bg-gray-100 dark:bg-gray-800"
                        : isToday
                          ? "bg-blue-100 dark:bg-gray-700/30"
                          : isWeekend
                            ? "bg-amber-50 dark:bg-amber-950/30"
                            : "bg-gray-100 dark:bg-gray-800",
                    )}
                  >
                    <p
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wide",
                        isClosed
                          ? "text-gray-400 dark:text-gray-500"
                          : isToday
                            ? "text-blue-700 dark:text-gray-100"
                            : isWeekend
                              ? "text-amber-700 dark:text-amber-500"
                              : "text-gray-600 dark:text-gray-400",
                      )}
                    >
                      {DAY_NAMES[di]}
                    </p>
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        isClosed
                          ? "text-gray-400 dark:text-gray-500"
                          : isToday
                            ? "text-blue-800 dark:text-gray-200"
                            : isWeekend
                              ? "text-amber-800 dark:text-amber-400"
                              : "text-gray-800 dark:text-gray-200",
                      )}
                    >
                      {formatHeaderDate(day)}
                    </p>
                    {isClosed && (
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-0.5">
                        Closed
                      </p>
                    )}
                  </div>
                );
              })}

            {/* Employee rows */}
            {employees.map((employee) => (
              <React.Fragment key={employee.id}>
                <div className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800/80 border-b border-r border-gray-200 dark:border-gray-700 px-3 py-2 flex flex-col justify-center min-h-16">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-50 truncate">
                      {employee.name}
                    </p>
                    {!employee.userId && (
                      <Tooltip content="Has not confirmed their email yet" side="top">
                        <span className="size-1.5 shrink-0 rounded-full bg-red-500 cursor-help" aria-label="Has not confirmed their email yet" />
                      </Tooltip>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {employee.jobRole}
                  </p>
                  {(() => {
                    const scheduled = scheduledHoursMap[employee.id] ?? 0;
                    const contracted = employee.contractedHours;
                    if (contracted === 0) return null;
                    const over = scheduled - contracted;
                    if (over > 0)
                      return (
                        <p className="text-xs mt-0.5 text-orange-500">
                          {scheduled.toFixed(1)}h / {contracted}h
                          <span className="ml-1 font-semibold">
                            (+{over.toFixed(1)}h)
                          </span>
                        </p>
                      );
                    const pct = scheduled / contracted;
                    return (
                      <p
                        className={`text-xs mt-0.5 ${pct >= 1 ? "text-green-600" : pct >= 0.5 ? "text-amber-500" : "text-red-500"}`}
                      >
                        {scheduled.toFixed(1)}h / {contracted}h
                      </p>
                    );
                  })()}
                </div>
                {days
                  .slice(startDayOffset, startDayOffset + visibleDays)
                  .map((day, si) => {
                    const di = startDayOffset + si;
                    const date = toISODate(day);
                    const cellId = `${employee.id}__${date}`;
                    const cellShifts = getShiftsForCell(employee.id, date);
                    const coverRole =
                      coverFocus && coverFocus.date === date
                        ? employee.id === coverFocus.requesterEmployeeId
                          ? "source"
                          : employee.id === coverFocus.claimedByEmployeeId
                            ? "dest"
                            : null
                        : null;
                    return (
                      <DroppableCell
                        key={cellId}
                        cellId={cellId}
                        employeeId={employee.id}
                        date={date}
                        shifts={cellShifts}
                        employee={employee}
                        jobRoles={jobRoles}
                        publishedAt={publishedAt}
                        isWeekend={di >= 5}
                        isClosed={closedDays[di]}
                        isTimeOff={isTimeOffDay(employee.id, date)}
                        conflict={getConflict?.(employee.id, date) ?? null}
                        coverRole={coverRole}
                        isToday={toISODate(day) === toISODate(new Date())}
                        onAddClick={openAddDialog}
                        onShiftClick={openEditDialog}
                      />
                    );
                  })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeShift &&
            (() => {
              const emp = employees.find(
                (e) => e.id === activeShift.employeeId,
              );
              if (!emp) return null;
              return (
                <div className="rotate-1 opacity-90 shadow-xl">
                  <ShiftCard
                    shift={activeShift}
                    employee={emp}
                    jobRoles={jobRoles}
                    publishedAt={publishedAt}
                    onClick={() => {}}
                  />
                </div>
              );
            })()}
        </DragOverlay>
      </DndContext>

      {/* Add Shift Dialog */}
      <AddShiftDialog
        open={addDialog.open}
        onOpenChange={(open) => setAddDialog((prev) => ({ ...prev, open }))}
        employees={employees}
        jobRoles={jobRoles}
        shiftTemplates={shiftTemplates}
        defaultEmployeeId={addDialog.employeeId}
        defaultDate={addDialog.date}
        getConflict={getConflict}
        onShiftCreate={onShiftCreate}
        onMarkSick={onMarkSick}
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
          onShiftCancel={onShiftCancel}
        />
      )}

      {/* Cancelled Shift Dialog */}
      {cancelledDialog.shift &&
        (() => {
          const emp = employees.find(
            (e) => e.id === cancelledDialog.shift!.employeeId,
          );
          if (!emp) return null;
          return (
            <CancelledShiftDialog
              open={cancelledDialog.open}
              onOpenChange={(open) =>
                setCancelledDialog((prev) => ({ ...prev, open }))
              }
              shift={cancelledDialog.shift!}
              employee={emp}
              onDelete={onShiftDelete}
            />
          );
        })()}

      {/* Sick Day Dialog */}
      {sickDialog.shift &&
        (() => {
          const emp = employees.find(
            (e) => e.id === sickDialog.shift!.employeeId,
          );
          if (!emp) return null;
          return (
            <SickDayDialog
              open={sickDialog.open}
              onOpenChange={(open) =>
                setSickDialog((prev) => ({ ...prev, open }))
              }
              shift={sickDialog.shift!}
              employee={emp}
              onDelete={onShiftDelete}
            />
          );
        })()}
    </div>
  );
}
