import { useState } from "react"
import { View, Text, FlatList, Pressable } from "react-native"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { Screen } from "@/components/layout/Screen"
import { ShiftCard } from "@/components/shifts/ShiftCard"
import { ClockWidget } from "@/components/shifts/ClockWidget"
import { ShiftCardSkeleton, ClockWidgetSkeleton } from "@/components/ui/Skeleton"
import { EmptyState } from "@/components/feedback/EmptyState"
import { ErrorState } from "@/components/feedback/ErrorState"
import { Divider } from "@/components/ui/Divider"
import { ManagerScheduleView } from "@/components/schedule/ManagerScheduleView"
import { RefreshButton } from "@/components/ui/RefreshButton"
import { useMyShifts } from "@/hooks/useShifts"
import { useCurrentUser } from "@/hooks/useEmployee"
import { useAuthStore } from "@/store/authStore"
import { isToday, todayISO, formatWeekday, formatDate } from "@/lib/utils"
import { currentWeek, weekDays, weekRangeLabel, offsetWeek } from "@/lib/dates"
import type { Shift } from "@skemaka/types"

type DayRow = { date: string; shift: Shift }

function WeekNav({
  week,
  onPrev,
  onNext,
  onReset,
}: {
  week: string
  onPrev: () => void
  onNext: () => void
  onReset: () => void
}) {
  const isThisWeek = week === currentWeek()

  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        onPress={onPrev}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Previous week"
        className="w-9 h-9 rounded-xl bg-elevated items-center justify-center active:opacity-60"
      >
        <Ionicons name="chevron-back" size={18} color="#A1A1AE" />
      </Pressable>

      <Pressable
        onPress={isThisWeek ? undefined : onReset}
        accessibilityRole="button"
        accessibilityLabel={isThisWeek ? "Current week" : "Jump to current week"}
        className="flex-1 items-center py-1"
      >
        <Text className="text-sm font-semibold text-ink">{weekRangeLabel(week)}</Text>
        {!isThisWeek && (
          <Text className="text-[11px] text-brand font-medium mt-0.5">Jump to today</Text>
        )}
      </Pressable>

      <Pressable
        onPress={onNext}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Next week"
        className="w-9 h-9 rounded-xl bg-elevated items-center justify-center active:opacity-60"
      >
        <Ionicons name="chevron-forward" size={18} color="#A1A1AE" />
      </Pressable>
    </View>
  )
}

export default function ShiftsScreen() {
  const { activeView } = useAuthStore()
  if (activeView === "MANAGER") return <ManagerScheduleView />

  return <EmployeeShiftsScreen />
}

function EmployeeShiftsScreen() {
  const { data: currentUser, isError: userError, refetch: refetchUser } = useCurrentUser()
  const router = useRouter()
  const [selectedWeek, setSelectedWeek] = useState(currentWeek)

  const { data: shifts, isLoading, isFetching, refetch } = useMyShifts(selectedWeek)

  if (userError) {
    return (
      <Screen>
        <ErrorState
          message="Could not load your profile."
          onRetry={() => void refetchUser()}
        />
      </Screen>
    )
  }

  const isCurrentWeek = selectedWeek === currentWeek()
  const todayShift = isCurrentWeek ? (shifts?.find((s) => s.date === todayISO()) ?? null) : null

  const dayRows: DayRow[] = shifts
    ? weekDays(selectedWeek)
        .map((date) => ({ date, shift: shifts.find((s) => s.date === date) }))
        .filter((d): d is DayRow => d.shift !== undefined)
    : []

  return (
    <Screen scroll={false} padded={false} edges={["top"]}>
      <View className="px-4 pt-4 pb-3 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-ink">My Shifts</Text>
        <RefreshButton onPress={() => void refetch()} isRefreshing={isFetching} />
      </View>

      <View className="px-4 pb-3">
        <WeekNav
          week={selectedWeek}
          onPrev={() => setSelectedWeek((w) => offsetWeek(w, -1))}
          onNext={() => setSelectedWeek((w) => offsetWeek(w, 1))}
          onReset={() => setSelectedWeek(currentWeek())}
        />
      </View>

      <FlatList
        data={dayRows}
        keyExtractor={(item) => item.date}
        contentContainerClassName="px-4 pb-10"
        onRefresh={() => void refetch()}
        refreshing={isFetching && !isLoading}
        ListHeaderComponent={
          isCurrentWeek ? (
            <View className="mb-4">
              {isLoading ? (
                <>
                  <ClockWidgetSkeleton />
                  <Divider className="mt-4" />
                </>
              ) : (
                <>
                  <ClockWidget todayShift={todayShift} />
                  {dayRows.length > 0 && <Divider className="mt-4" />}
                </>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="gap-3">
              <ShiftCardSkeleton />
              <ShiftCardSkeleton />
              <ShiftCardSkeleton />
            </View>
          ) : (
            <EmptyState
              icon="📭"
              title="No shifts this week"
              description="Your manager hasn't scheduled any shifts for you yet."
            />
          )
        }
        renderItem={({ item }) => (
          <View className="mb-4">
            <View className="flex-row items-center gap-2 mb-2">
              <Text
                className={`text-sm font-semibold ${isToday(item.date) ? "text-brand" : "text-ink-secondary"}`}
              >
                {formatWeekday(item.date)}
              </Text>
              <Text className="text-xs text-ink-muted">{formatDate(item.date)}</Text>
            </View>
            <ShiftCard
              shift={item.shift}
              industry={currentUser?.industry}
              onPress={() =>
                router.push(`/(tabs)/shifts/${item.shift.id}?week=${selectedWeek}`)
              }
            />
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  )
}
