import { useState, useMemo } from "react"
import { View, Text, Alert, FlatList, Pressable, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { Screen } from "@/components/layout/Screen"
import { LoadingState } from "@/components/feedback/LoadingState"
import { ErrorState } from "@/components/feedback/ErrorState"
import { Button } from "@/components/ui/Button"
import { RefreshButton } from "@/components/ui/RefreshButton"
import { TimePickerModal } from "@/components/ui/TimePicker"
import { ShiftFormSheet } from "@/components/schedule/ShiftFormSheet"
import {
  useOpenRequest,
  useMySubmission,
  useSubmitAvailability,
  useAllSubmissions,
} from "@/hooks/useAvailability"
import { useManagerSchedule, useOrgEmployees } from "@/hooks/useManagerSchedule"
import { useAuthStore } from "@/store/authStore"
import { formatDateLong, formatTime, todayISO } from "@/lib/utils"
import { weekDays, currentWeek, offsetWeek, weekRangeLabel } from "@/lib/dates"
import { DEFAULT_ORG_HOURS } from "@skemaka/api"
import type { Employee, AvailabilityDay, DayHours } from "@skemaka/types"
import type { ShiftInput } from "@skemaka/api"

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const DAY_SHORT  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

// ─── Day state ────────────────────────────────────────────────────────────────

type DayStatus = "available" | "off"

type DayEntry = { status: DayStatus; start: string; end: string }

const STATUS_CONFIG: Record<DayStatus, { label: string; color: string; bg: string; border: string }> = {
  available: { label: "Available",     color: "#30D158", bg: "rgba(48,209,88,0.12)", border: "rgba(48,209,88,0.25)" },
  off:       { label: "Not available", color: "#4A4A57", bg: "rgba(74,74,87,0.10)",  border: "rgba(74,74,87,0.15)"  },
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_WEEKS_AHEAD = 4
const MAX_WEEKS_BACK  = 8

// ─── WeekNav (shared) ─────────────────────────────────────────────────────────

function WeekNav({
  weekStart,
  onChange,
  canGoBack = true,
  canGoForward,
}: {
  weekStart: string
  onChange: (w: string) => void
  canGoBack?: boolean
  canGoForward: boolean
}) {
  return (
    <View className="flex-row items-center justify-between px-4 pb-3 pt-1">
      <Pressable
        onPress={() => { if (canGoBack) { void Haptics.selectionAsync(); onChange(offsetWeek(weekStart, -1)) } }}
        hitSlop={8}
        disabled={!canGoBack}
        accessibilityRole="button"
        accessibilityLabel="Previous week"
        accessibilityState={{ disabled: !canGoBack }}
        className="w-8 h-8 items-center justify-center rounded-full active:opacity-60"
        style={{ backgroundColor: canGoBack ? "rgba(255,255,255,0.06)" : "transparent" }}
      >
        <Ionicons name="chevron-back" size={18} color={canGoBack ? "#9898A8" : "#3A3A44"} importantForAccessibility="no" />
      </Pressable>

      <Text style={{ fontSize: 13, fontWeight: "600", color: "#9898A8" }}>
        {weekRangeLabel(weekStart)}
      </Text>

      <Pressable
        onPress={() => { if (canGoForward) { void Haptics.selectionAsync(); onChange(offsetWeek(weekStart, 1)) } }}
        hitSlop={8}
        disabled={!canGoForward}
        accessibilityRole="button"
        accessibilityLabel="Next week"
        accessibilityState={{ disabled: !canGoForward }}
        className="w-8 h-8 items-center justify-center rounded-full active:opacity-60"
        style={{ backgroundColor: canGoForward ? "rgba(255,255,255,0.06)" : "transparent" }}
      >
        <Ionicons name="chevron-forward" size={18} color={canGoForward ? "#9898A8" : "#3A3A44"} importantForAccessibility="no" />
      </Pressable>
    </View>
  )
}

// ─── DayCard ──────────────────────────────────────────────────────────────────

function DayCard({
  date,
  index,
  entry,
  readOnly = false,
  isPast = false,
  dayHours,
  onChange,
  onEdit,
  onClose,
}: {
  date: string
  index: number
  entry: DayEntry
  readOnly?: boolean
  isPast?: boolean
  dayHours: DayHours
  onChange: (e: DayEntry) => void
  onEdit?: () => void
  onClose?: () => void
}) {
  const [picker, setPicker] = useState<"start" | "end" | null>(null)
  const dayNum  = new Date(date + "T00:00:00Z").getUTCDate()
  const cfg      = STATUS_CONFIG[entry.status]
  const showTimes = entry.status !== "off"

  function selectStatus(s: DayStatus) {
    void Haptics.selectionAsync()
    if (s === "off") {
      onChange({ ...entry, status: "off" })
    } else {
      const defaultStart = dayHours.isOpen ? dayHours.openTime : "09:00"
      const defaultEnd   = dayHours.isOpen ? dayHours.closeTime : "17:00"
      onChange({
        status: "available",
        start:  entry.status === "off" ? defaultStart : entry.start,
        end:    entry.status === "off" ? defaultEnd   : entry.end,
      })
    }
  }

  return (
    <View style={{
      borderRadius: 16,
      borderWidth: 1,
      borderColor: entry.status === "off" ? "rgba(74,74,87,0.16)" : cfg.border,
      backgroundColor: "#1A1A22",
      overflow: "hidden",
      opacity: isPast ? 0.4 : 1,
    }}>
      {/* Header row */}
      <View className="flex-row items-center" style={{ paddingRight: 16, paddingTop: 14, paddingBottom: readOnly ? 14 : 10 }}>
        <View style={{
          width: 4,
          alignSelf: "stretch",
          backgroundColor: cfg.color,
          borderTopLeftRadius: 16,
          borderBottomLeftRadius: 16,
          marginRight: 14,
        }} />
        <View className="flex-1">
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#F2F2F7" }}>
            {DAY_LABELS[index]} {dayNum}
          </Text>
          <Text style={{ fontSize: 12, marginTop: 2, color: cfg.color, fontWeight: "600" }}>
            {cfg.label}{readOnly && showTimes ? `  ·  ${formatTime(entry.start)} – ${formatTime(entry.end)}` : ""}
          </Text>
        </View>
        {readOnly && onEdit && (
          <Pressable
            onPress={() => { void Haptics.selectionAsync(); onEdit() }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${entry.status === "available" ? "Edit" : "Set"} availability for ${DAY_LABELS[index]}`}
            className="px-3 py-1.5 rounded-xl active:opacity-70"
            style={{ backgroundColor: "rgba(123,110,248,0.12)", borderWidth: 1, borderColor: "rgba(123,110,248,0.25)" }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#7B6EF8" }}>
              {entry.status === "available" ? "Edit" : "Set"}
            </Text>
          </Pressable>
        )}
        {!readOnly && onClose && (
          <Pressable
            onPress={() => { void Haptics.selectionAsync(); onClose() }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Close editor for ${DAY_LABELS[index]}`}
            className="w-7 h-7 items-center justify-center rounded-full active:opacity-70"
            style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
          >
            <Ionicons name="close" size={15} color="#6B6B7B" importantForAccessibility="no" />
          </Pressable>
        )}
      </View>

      {/* Two-button row — editable only */}
      {!readOnly && (
        <View className="flex-row gap-2 px-4 pb-3">
          {(["available", "off"] as const).map((s) => {
            const c = STATUS_CONFIG[s]
            const active = entry.status === s
            return (
              <Pressable
                key={s}
                onPress={() => selectStatus(s)}
                accessibilityRole="button"
                accessibilityLabel={c.label}
                accessibilityState={{ selected: active }}
                className="flex-1 py-2 items-center rounded-xl active:opacity-70"
                style={{
                  backgroundColor: active ? c.bg : "#141417",
                  borderWidth: 1,
                  borderColor: active ? c.border : "rgba(255,255,255,0.14)",
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: active ? c.color : "#9898A8" }}>
                  {c.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}

      {/* Time range row — editable + Available only */}
      {showTimes && !readOnly && (
        <View
          className="flex-row items-center gap-2 px-4 pb-4"
          style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" }}
        >
          <Pressable
            onPress={() => setPicker("start")}
            accessibilityRole="button"
            accessibilityLabel={`From: ${formatTime(entry.start)}`}
            className="flex-1 items-center rounded-xl py-2.5 active:opacity-70"
            style={{ backgroundColor: "#141417", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}
          >
            <Text style={{ fontSize: 10, color: "#6B6B7B" }}>From</Text>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#F2F2F7" }}>{formatTime(entry.start)}</Text>
          </Pressable>

          {/* Arrow is decorative — the two Pressable labels convey the range */}
          <Ionicons name="arrow-forward" size={14} color="#4A4A57" importantForAccessibility="no" />

          <Pressable
            onPress={() => setPicker("end")}
            accessibilityRole="button"
            accessibilityLabel={`Until: ${formatTime(entry.end)}`}
            className="flex-1 items-center rounded-xl py-2.5 active:opacity-70"
            style={{ backgroundColor: "#141417", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}
          >
            <Text style={{ fontSize: 10, color: "#6B6B7B" }}>Until</Text>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#F2F2F7" }}>{formatTime(entry.end)}</Text>
          </Pressable>
        </View>
      )}

      {/* Time picker modal */}
      {!readOnly && (
        <TimePickerModal
          visible={Boolean(picker)}
          title={picker === "start" ? "From" : "Until"}
          selected={picker === "start" ? entry.start : entry.end}
          minTime={dayHours.isOpen ? dayHours.openTime : undefined}
          maxTime={dayHours.isOpen ? dayHours.closeTime : undefined}
          onSelect={(time) => { onChange({ ...entry, [picker!]: time }) }}
          onClose={() => setPicker(null)}
        />
      )}
    </View>
  )
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ available, off }: { available: number; off: number }) {
  return (
    <View className="flex-row items-center gap-4 px-4 pb-3">
      <View className="flex-row items-center gap-1.5">
        {/* Color dot is decorative — text below carries the meaning */}
        <View importantForAccessibility="no" accessibilityElementsHidden style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: STATUS_CONFIG.available.color }} />
        <Text style={{ fontSize: 12, color: "#9898A8" }}>{available} available</Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <View importantForAccessibility="no" accessibilityElementsHidden style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: STATUS_CONFIG.off.color }} />
        <Text style={{ fontSize: 12, color: "#9898A8" }}>{off} not available</Text>
      </View>
    </View>
  )
}

// ─── Employee view ────────────────────────────────────────────────────────────

const DEFAULT_ENTRY: DayEntry = { status: "off", start: "09:00", end: "17:00" }

function submittedDayToEntry(day: AvailabilityDay | undefined): DayEntry {
  if (!day || !day.isAvailable) return DEFAULT_ENTRY
  return { status: "available", start: day.startTime ?? "09:00", end: day.endTime ?? "17:00" }
}

function EmployeeAvailabilityView() {
  const [weekStart, setWeekStart] = useState<string>(currentWeek)
  const { data, isLoading: loadingReq, isError, refetch } = useOpenRequest(weekStart)
  const request  = data?.request ?? null
  const orgHours = data?.orgHours ?? DEFAULT_ORG_HOURS

  const { data: existing, isLoading: loadingSub } = useMySubmission(request?.id)
  const submit = useSubmitAvailability(request?.id)

  const [dayEntries, setDayEntries] = useState<Record<string, DayEntry>>({})
  const [editingDate, setEditingDate] = useState<string | null>(null)

  const isLoading    = loadingReq || loadingSub
  const canGoBack    = weekStart > offsetWeek(currentWeek(), -MAX_WEEKS_BACK)
  const canGoForward = weekStart < offsetWeek(currentWeek(), MAX_WEEKS_AHEAD)

  function changeWeek(w: string) {
    setWeekStart(w)
    setDayEntries({})
    setEditingDate(null)
  }

  function startEditingDay(date: string) {
    const submittedDays = existing?.days ?? []
    const entry = submittedDayToEntry(submittedDays.find((d) => d.date === date))
    setDayEntries((prev) => ({ ...prev, [date]: entry }))
    setEditingDate(date)
  }

  if (isLoading) return <LoadingState label="Loading…" />
  if (isError)   return <ErrorState onRetry={() => void refetch()} />

  if (!request) {
    return (
      <Screen scroll={false} padded={false} edges={["top"]}>
        <View className="flex-row items-center justify-between px-4 pt-4 pb-1 pr-3">
          <Text className="text-2xl font-bold text-ink">Availability</Text>
          <RefreshButton onPress={() => void refetch()} isRefreshing={loadingReq} />
        </View>
        <WeekNav weekStart={weekStart} onChange={changeWeek} canGoBack={canGoBack} canGoForward={canGoForward} />
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Text style={{ fontSize: 36 }}>📅</Text>
          <Text className="text-base font-semibold text-ink text-center">Nothing here</Text>
          <Text className="text-sm text-ink-muted text-center">
            No availability recorded for this week.
          </Text>
        </View>
      </Screen>
    )
  }

  const days = weekDays(request.weekStart)
  const isEditing = editingDate !== null

  function getEntry(date: string): DayEntry {
    if (editingDate === date && dayEntries[date]) return dayEntries[date]
    const submittedDays = existing?.days ?? []
    return submittedDayToEntry(submittedDays.find((d) => d.date === date))
  }

  const availCount = days.filter((d) => getEntry(d).status === "available").length
  const offCount   = days.filter((d) => getEntry(d).status === "off").length

  return (
    <Screen scroll={false} padded={false} edges={["top"]}>
      <View className="px-4 pt-4 pb-1 pr-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-ink">Availability</Text>
          <View className="flex-row items-center gap-2">
            {isEditing && (
              <Pressable
                onPress={() => { setEditingDate(null); setDayEntries({}) }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cancel availability editing"
                className="px-3 py-1.5 rounded-xl active:opacity-70"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#9898A8" }}>Cancel</Text>
              </Pressable>
            )}
            <RefreshButton onPress={() => void refetch()} isRefreshing={loadingReq} />
          </View>
        </View>
        <Text className="text-sm text-ink-secondary mt-0.5">
          {isEditing
            ? "Update your availability for this week"
            : existing
            ? "Submitted"
            : "Set your availability for this week"}
        </Text>
      </View>
      <WeekNav weekStart={weekStart} onChange={changeWeek} canGoBack={canGoBack} canGoForward={canGoForward} />
      <SummaryStrip available={availCount} off={offCount} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: isEditing ? 16 : 32, gap: 8 }}
      >
        {days.map((date, i) => {
          const isEditingDay = editingDate === date
          const isPast = date < todayISO()
          return (
            <DayCard
              key={date}
              date={date}
              index={i}
              entry={getEntry(date)}
              readOnly={!isEditingDay}
              isPast={isPast}
              dayHours={orgHours[i] ?? orgHours[0]}
              onChange={(e) => setDayEntries((prev) => ({ ...prev, [date]: e }))}
              onEdit={!isEditingDay && !isPast ? () => startEditingDay(date) : undefined}
              onClose={isEditingDay ? () => setEditingDate(null) : undefined}
            />
          )
        })}
      </ScrollView>

      {isEditing && (
        <View
          className="px-4 pt-3 pb-6"
          style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}
        >
          <Button
            variant="primary"
            fullWidth
            loading={submit.isPending}
            onPress={() => {
              const dayInputs = days.map((date) => {
                const e = getEntry(date)
                return {
                  date,
                  isAvailable: e.status === "available",
                  startTime:   e.status === "available" ? e.start : null,
                  endTime:     e.status === "available" ? e.end   : null,
                }
              })
              submit.mutate(dayInputs, {
                onSuccess: () => { setEditingDate(null); setDayEntries({}) },
                onError: () => Alert.alert("Error", "Could not submit. Please try again."),
              })
            }}
          >
            Update Availability
          </Button>
        </View>
      )}
    </Screen>
  )
}

// ─── Manager view ─────────────────────────────────────────────────────────────

type SheetState =
  | { open: false }
  | { open: true; date: string; scheduleId: string; employeeId: string; start: string; end: string }

function ManagerAvailabilityView() {
  const [mgrWeekStart, setMgrWeekStart] = useState<string>(currentWeek)
  const { data, isLoading: loadingReq, isError, refetch } = useOpenRequest(mgrWeekStart)
  const request = data?.request ?? null

  const { data: submissions = [], isLoading: loadingSubs } = useAllSubmissions(request?.id)
  const { data: employees = [], isLoading: loadingEmps }   = useOrgEmployees()

  const weekStart = request?.weekStart ?? mgrWeekStart
  const { schedule, ensureSchedule, addShift } = useManagerSchedule(weekStart)

  const mgrCanGoForward = mgrWeekStart < offsetWeek(currentWeek(), MAX_WEEKS_AHEAD)

  const today = todayISO()
  const days  = request ? weekDays(request.weekStart) : []

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    days.includes(today) ? today : (days[0] ?? ""),
  )
  const effectiveDate = days.includes(selectedDate) ? selectedDate : (days[0] ?? "")

  const [sheetState, setSheetState] = useState<SheetState>({ open: false })

  const isLoading = loadingReq || loadingSubs || loadingEmps

  const dayMap = useMemo((): Map<string, AvailabilityDay | null> => {
    const map = new Map<string, AvailabilityDay | null>()
    for (const emp of employees) {
      const sub = submissions.find((s) => s.employeeId === emp.id)
      if (!sub) {
        map.set(emp.id, null)
      } else {
        const day = sub.days?.find((d) => d.date === effectiveDate) ?? null
        map.set(emp.id, day)
      }
    }
    return map
  }, [submissions, employees, effectiveDate])

  const scheduledIds = useMemo(
    () => new Set((schedule?.shifts ?? []).filter((s) => s.date === effectiveDate).map((s) => s.employeeId)),
    [schedule, effectiveDate],
  )

  if (isLoading) return <LoadingState label="Loading…" />
  if (isError)   return <ErrorState onRetry={() => void refetch()} />

  if (!request) {
    return (
      <Screen scroll={false} padded={false} edges={["top"]}>
        <View className="flex-row items-center justify-between px-4 pt-4 pb-1 pr-3">
          <Text className="text-2xl font-bold text-ink">Availability</Text>
          <RefreshButton onPress={() => void refetch()} isRefreshing={loadingReq} />
        </View>
        <WeekNav weekStart={mgrWeekStart} onChange={(w) => { setMgrWeekStart(w); setSelectedDate("") }} canGoBack={mgrWeekStart > offsetWeek(currentWeek(), -MAX_WEEKS_BACK)} canGoForward={mgrCanGoForward} />
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Text style={{ fontSize: 36 }}>📋</Text>
          <Text className="text-base font-semibold text-ink text-center">No request for this week</Text>
          <Text className="text-sm text-ink-muted text-center">
            Open the web dashboard to create an availability request, or adjust the availability window in Settings.
          </Text>
        </View>
      </Screen>
    )
  }

  const available    = employees.filter((e) => dayMap.get(e.id)?.isAvailable === true)
  const unavailable  = employees.filter((e) => dayMap.get(e.id)?.isAvailable === false)
  const noResponse   = employees.filter((e) => dayMap.get(e.id) === null)

  async function openAssignSheet(employee: Employee) {
    void Haptics.selectionAsync()
    let scheduleId = schedule?.id
    if (!scheduleId) {
      try {
        const created = await ensureSchedule.mutateAsync()
        scheduleId = created.id
      } catch {
        Alert.alert("Error", "Could not prepare schedule. Please try again.")
        return
      }
    }
    const day = dayMap.get(employee.id)
    setSheetState({
      open: true,
      date: effectiveDate,
      scheduleId,
      employeeId: employee.id,
      start: day?.startTime ?? "09:00",
      end:   day?.endTime   ?? "17:00",
    })
  }

  async function handleSave(input: ShiftInput) {
    if (!sheetState.open) return
    try {
      await addShift.mutateAsync({ scheduleId: sheetState.scheduleId, input })
      setSheetState({ open: false })
    } catch (err: unknown) {
      Alert.alert("Could not save shift", err instanceof Error ? err.message : "Please try again.")
    }
  }

  return (
    <Screen scroll={false} padded={false} edges={["top"]}>
      {/* Fixed header */}
      <View>
        <View className="px-4 pt-4 pb-1 pr-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-ink">Availability</Text>
            <RefreshButton onPress={() => void refetch()} isRefreshing={loadingReq} />
          </View>
          <Text className="text-sm text-ink-secondary mt-0.5">
            Due {formatDateLong(request.deadline)}
          </Text>
        </View>
        <WeekNav weekStart={mgrWeekStart} onChange={(w) => { setMgrWeekStart(w); setSelectedDate("") }} canGoBack={mgrWeekStart > offsetWeek(currentWeek(), -MAX_WEEKS_BACK)} canGoForward={mgrCanGoForward} />

        {/* Response summary */}
        <View className="flex-row gap-2 px-4 py-3">
          <View className="flex-1 bg-success/10 border border-success/20 rounded-xl px-3 py-2 items-center">
            <Text className="text-lg font-bold text-success">{submissions.length}</Text>
            <Text className="text-[10px] text-ink-muted mt-0.5">Responded</Text>
          </View>
          <View className="flex-1 bg-elevated border border-line/40 rounded-xl px-3 py-2 items-center">
            <Text className="text-lg font-bold text-ink-secondary">{employees.length - submissions.length}</Text>
            <Text className="text-[10px] text-ink-muted mt-0.5">Pending</Text>
          </View>
          <View className="flex-1 bg-elevated border border-line/40 rounded-xl px-3 py-2 items-center">
            <Text className="text-lg font-bold text-ink">{employees.length}</Text>
            <Text className="text-[10px] text-ink-muted mt-0.5">Total</Text>
          </View>
        </View>

        {/* Day strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 12 }}
        >
          {days.map((date, i) => {
            const isSelected = date === effectiveDate
            const dayAvailCount = submissions.filter((s) =>
              s.days?.find((d) => d.date === date && d.isAvailable),
            ).length

            return (
              <Pressable
                key={date}
                onPress={() => { void Haptics.selectionAsync(); setSelectedDate(date) }}
                accessibilityRole="button"
                accessibilityLabel={`${DAY_SHORT[i]} ${new Date(date + "T00:00:00Z").getUTCDate()}, ${dayAvailCount} available`}
                accessibilityState={{ selected: isSelected }}
                className="items-center active:opacity-70"
                style={{
                  minWidth: 52,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 14,
                  borderWidth: isSelected ? 1.5 : 1,
                  borderColor: isSelected ? "#7B6EF8" : "rgba(255,255,255,0.08)",
                  backgroundColor: isSelected ? "rgba(123,110,248,0.12)" : "#1C1C22",
                }}
              >
                <Text style={{ fontSize: 11, color: isSelected ? "#9B8FFA" : "#6B6B7B", fontWeight: "600" }}>
                  {DAY_SHORT[i]}
                </Text>
                <Text style={{ fontSize: 15, color: isSelected ? "#FFFFFF" : "#9898A8", fontWeight: "700", marginTop: 2 }}>
                  {new Date(date + "T00:00:00Z").getUTCDate()}
                </Text>
                {dayAvailCount > 0 && (
                  // Dot is decorative — the count is already in accessibilityLabel above
                  <View importantForAccessibility="no" accessibilityElementsHidden style={{ marginTop: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: isSelected ? "#7B6EF8" : "#30D158" }} />
                )}
              </Pressable>
            )
          })}
        </ScrollView>

        <View className="h-px bg-line/30 mx-4" />
      </View>

      {/* Scrollable day content */}
      <FlatList
        data={[...available, ...unavailable, ...noResponse]}
        keyExtractor={(e) => e.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={
          available.length > 0 ? (
            <Text className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-2">
              Available · {available.length}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-16 gap-1">
            <Text className="text-sm text-ink-secondary">No responses yet</Text>
            <Text className="text-xs text-ink-muted">Employees haven't submitted for this week</Text>
          </View>
        }
        renderItem={({ item: employee, index }) => {
          const day        = dayMap.get(employee.id)
          const isAvail    = day?.isAvailable === true
          const isScheduled = scheduledIds.has(employee.id)
          const noResp     = day === null

          const allEmployees = [...available, ...unavailable, ...noResponse]
          const prevEmployee = index > 0 ? allEmployees[index - 1] : null
          const prevIsAvail    = prevEmployee ? dayMap.get(prevEmployee.id)?.isAvailable === true : false
          const prevIsUnavail  = prevEmployee ? dayMap.get(prevEmployee.id)?.isAvailable === false : false
          const showUnavailHeader = !isAvail && !noResp && (index === 0 || prevIsAvail)
          const showNoRespHeader  = noResp && (index === 0 || !prevIsAvail && !prevIsUnavail ? true : !noResponse.includes(prevEmployee!))

          return (
            <View>
              {showUnavailHeader && (
                <Text className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-2 mt-4">
                  Unavailable · {unavailable.length}
                </Text>
              )}
              {showNoRespHeader && (
                <Text className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-2 mt-4">
                  No response · {noResponse.length}
                </Text>
              )}

              <View
                className="bg-surface border rounded-2xl px-4 py-3.5 flex-row items-center gap-3"
                style={{ borderColor: isAvail ? "rgba(48,209,88,0.25)" : "rgba(255,255,255,0.07)" }}
              >
                {/* Status icon — decorative; the text below conveys available/unavailable/no response */}
                <View
                  importantForAccessibility="no"
                  accessibilityElementsHidden
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: isAvail
                      ? "rgba(48,209,88,0.12)"
                      : noResp
                      ? "rgba(74,74,87,0.2)"
                      : "rgba(255,69,58,0.1)",
                  }}
                >
                  <Ionicons
                    name={isAvail ? "checkmark" : noResp ? "time-outline" : "close"}
                    size={16}
                    color={isAvail ? "#30D158" : noResp ? "#6B6B7B" : "#FF453A"}
                    importantForAccessibility="no"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-sm font-semibold text-ink">
                    {employee.name}
                  </Text>
                  <Text className="text-xs text-ink-muted mt-0.5">
                    {isAvail
                      ? (day?.startTime && day?.endTime ? `${formatTime(day.startTime)} – ${formatTime(day.endTime)}` : "All day")
                      : noResp
                      ? "Hasn't responded"
                      : "Unavailable this day"}
                  </Text>
                </View>

                {isAvail && (
                  isScheduled ? (
                    <View
                      className="px-2.5 py-1 rounded-lg"
                      style={{ backgroundColor: "rgba(123,110,248,0.12)" }}
                    >
                      <Text style={{ fontSize: 11, color: "#7B6EF8", fontWeight: "600" }}>
                        Scheduled ✓
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => void openAssignSheet(employee)}
                      disabled={ensureSchedule.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={`Assign shift to ${employee.name}`}
                      accessibilityState={{ disabled: ensureSchedule.isPending }}
                      className="px-3 py-1.5 rounded-xl active:opacity-70"
                      style={{ backgroundColor: "rgba(48,209,88,0.12)", borderWidth: 1, borderColor: "rgba(48,209,88,0.2)" }}
                    >
                      <Text style={{ fontSize: 12, color: "#30D158", fontWeight: "600" }}>
                        Assign Shift
                      </Text>
                    </Pressable>
                  )
                )}
              </View>
            </View>
          )
        }}
      />

      <ShiftFormSheet
        visible={sheetState.open}
        date={sheetState.open ? sheetState.date : effectiveDate}
        shift={null}
        employees={employees}
        isSaving={addShift.isPending}
        defaultValues={sheetState.open
          ? { employeeId: sheetState.employeeId, startTime: sheetState.start, endTime: sheetState.end }
          : undefined}
        onSave={handleSave}
        onClose={() => setSheetState({ open: false })}
      />
    </Screen>
  )
}

// ─── Screen root ──────────────────────────────────────────────────────────────

export default function AvailabilityScreen() {
  const { activeView } = useAuthStore()
  return activeView === "MANAGER"
    ? <ManagerAvailabilityView />
    : <EmployeeAvailabilityView />
}
