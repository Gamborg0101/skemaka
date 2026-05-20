import { useState, useMemo } from "react"
import { View, Text, FlatList, Pressable, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { Screen } from "@/components/layout/Screen"
import { ShiftFormSheet } from "@/components/schedule/ShiftFormSheet"
import { WeekNav, DayStrip } from "@/components/schedule/WeekControls"
import { ShiftCardSkeleton } from "@/components/ui/Skeleton"
import { useManagerSchedule, useOrgEmployees } from "@/hooks/useManagerSchedule"
import { currentWeek, weekDays, offsetWeek } from "@/lib/dates"
import { formatTime, formatDateLong, todayISO } from "@/lib/utils"
import type { Shift, Employee } from "@skemaka/types"
import type { ShiftInput } from "@skemaka/api"

// ─── Shift item ───────────────────────────────────────────────────────────────

type ShiftRow = Shift & { employeeName: string }

function ShiftItem({ shift, onPress }: { shift: ShiftRow; onPress: (s: Shift) => void }) {
  return (
    <Pressable
      onPress={async () => {
        await Haptics.selectionAsync()
        onPress(shift)
      }}
      className="bg-surface border border-line/60 rounded-2xl px-4 py-4 flex-row items-center active:opacity-75"
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-semibold text-ink leading-snug">
          {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
        </Text>
        <Text className="text-sm text-ink-secondary">
          {shift.employeeName}
          {shift.jobRole ? ` · ${shift.jobRole}` : ""}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#4A4A57" />
    </Pressable>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

type SheetState =
  | { open: false }
  | { open: true; date: string; scheduleId: string; shift: Shift | null }

export function ManagerScheduleView() {
  const today = todayISO()

  const [selectedWeek, setSelectedWeek] = useState(currentWeek)
  const [selectedDate, setSelectedDate] = useState(today)
  const [sheetState, setSheetState] = useState<SheetState>({ open: false })

  const { schedule, isLoading, isFetching, refetch, ensureSchedule, addShift, editShift, removeShift } =
    useManagerSchedule(selectedWeek)
  const { data: employees = [] } = useOrgEmployees()

  const days = weekDays(selectedWeek)

  const employeeMap = useMemo(
    () => new Map<string, Employee>(employees.map((e) => [e.id, e])),
    [employees],
  )

  // Shifts for the currently visible day — recalculated only when relevant state changes.
  const dayShifts = useMemo(
    (): ShiftRow[] =>
      (schedule?.shifts ?? [])
        .filter((s) => s.date === selectedDate)
        .map((s) => ({
          ...s,
          employeeName: employeeMap.get(s.employeeId)?.name ?? "Unknown",
        })),
    [schedule, employeeMap, selectedDate],
  )

  // When navigating weeks, snap to today (if present) or Monday.
  function changeWeek(newWeek: string) {
    const newDays = weekDays(newWeek)
    setSelectedWeek(newWeek)
    setSelectedDate(newDays.includes(today) ? today : newDays[0])
  }

  // ── Sheet management ────────────────────────────────────────────────────────

  async function openAddShift(date: string) {
    let scheduleId = schedule?.id
    if (!scheduleId) {
      try {
        const created = await ensureSchedule.mutateAsync()
        scheduleId = created.id
      } catch {
        Alert.alert("Error", "Could not create schedule. Please try again.")
        return
      }
    }
    setSheetState({ open: true, date, scheduleId, shift: null })
  }

  function openEditShift(shift: Shift) {
    if (!schedule?.id) return
    setSheetState({ open: true, date: shift.date, scheduleId: schedule.id, shift })
  }

  function closeSheet() {
    setSheetState({ open: false })
  }

  async function handleSave(input: ShiftInput) {
    if (!sheetState.open) return
    const { scheduleId, shift } = sheetState
    try {
      if (shift) {
        await editShift.mutateAsync({ scheduleId, shiftId: shift.id, input })
      } else {
        await addShift.mutateAsync({ scheduleId, input })
      }
      closeSheet()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Please try again."
      Alert.alert("Could not save shift", msg)
    }
  }

  async function handleDelete() {
    if (!sheetState.open || !sheetState.shift) return
    const { scheduleId, shift } = sheetState
    Alert.alert("Delete Shift", "Remove this shift from the schedule?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await removeShift.mutateAsync({ scheduleId, shiftId: shift!.id })
            closeSheet()
          } catch {
            Alert.alert("Error", "Could not delete shift. Please try again.")
          }
        },
      },
    ])
  }

  const isSaving = addShift.isPending || editShift.isPending

  // ── Layout: fixed header + single-axis FlatList ─────────────────────────────
  //
  // The outer Screen is non-scrolling (flex column).
  // Everything above the FlatList is a plain View (fixed height, never scrolls).
  // The FlatList is the ONLY scroll container in this view — vertical only.
  // There are no nested scrollers anywhere in this component tree.

  return (
    <Screen scroll={false} padded={false} edges={["top"]}>

      {/* ── Fixed header — does not participate in scroll ── */}
      <View>
        <View className="px-4 pt-4 pb-2">
          <Text className="text-2xl font-bold text-ink">Schedule</Text>
        </View>

        <View className="px-4 pb-2">
          <WeekNav
            week={selectedWeek}
            onPrev={() => changeWeek(offsetWeek(selectedWeek, -1))}
            onNext={() => changeWeek(offsetWeek(selectedWeek, 1))}
            onReset={() => changeWeek(currentWeek())}
          />
        </View>

        {/* Day picker — plain View row, no scroll, no gesture conflict */}
        <View className="px-4 pb-1">
          <DayStrip days={days} selectedDate={selectedDate} onSelect={setSelectedDate} />
        </View>

        <View className="h-px bg-line/30 mx-4 mt-2" />
      </View>

      {/* ── Day content — the sole scroll container ── */}
      <FlatList
        data={dayShifts}
        keyExtractor={(s) => s.id}
        showsVerticalScrollIndicator={false}
        onRefresh={() => void refetch()}
        refreshing={isFetching && !isLoading}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={
          <View className="flex-row items-center justify-between py-4">
            <Text className="text-base font-semibold text-ink">
              {formatDateLong(selectedDate)}
            </Text>
            <Pressable
              onPress={() => void openAddShift(selectedDate)}
              hitSlop={8}
              className="flex-row items-center gap-1.5 active:opacity-60"
            >
              <Ionicons name="add-circle" size={22} color="#7B6EF8" />
              <Text className="text-sm font-semibold text-brand">Add Shift</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="gap-3">
              <ShiftCardSkeleton />
              <ShiftCardSkeleton />
              <ShiftCardSkeleton />
            </View>
          ) : (
            <View className="flex-1 items-center justify-center py-16 gap-1">
              <Text className="text-sm text-ink-secondary">No shifts scheduled</Text>
              <Text className="text-xs text-ink-muted">Tap "Add Shift" to schedule someone</Text>
            </View>
          )
        }
        renderItem={({ item }) => <ShiftItem shift={item} onPress={openEditShift} />}
      />

      <ShiftFormSheet
        visible={sheetState.open}
        date={sheetState.open ? sheetState.date : today}
        shift={sheetState.open ? sheetState.shift : null}
        employees={employees}
        isSaving={isSaving}
        onSave={handleSave}
        onDelete={sheetState.open && sheetState.shift ? handleDelete : undefined}
        onClose={closeSheet}
      />
    </Screen>
  )
}
