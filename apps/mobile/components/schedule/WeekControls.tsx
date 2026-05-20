import { View, Text, Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { currentWeek, weekRangeLabel } from "@/lib/dates"
import { isToday } from "@/lib/utils"

// ─── Week navigation ──────────────────────────────────────────────────────────
// Padding-free — callers wrap with `px-4`.

export function WeekNav({
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

// ─── Day strip ────────────────────────────────────────────────────────────────
// 7 equal-width tap targets in a single non-scrolling row.
// Plain View — no FlatList, no scroll, no gesture conflict with parent.
// Padding-free — callers wrap with `px-4`.

export function DayStrip({
  days,
  selectedDate,
  onSelect,
}: {
  days: string[]
  selectedDate: string
  onSelect: (date: string) => void
}) {
  return (
    <View className="flex-row gap-1">
      {days.map((date) => {
        const isSelected = date === selectedDate
        const today = isToday(date)
        const d = new Date(date + "T00:00:00Z")
        const abbr = d
          .toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })
          .slice(0, 3)
          .toUpperCase()
        const num = d.getUTCDate()

        return (
          <Pressable
            key={date}
            onPress={async () => {
              if (date !== selectedDate) await Haptics.selectionAsync()
              onSelect(date)
            }}
            accessibilityRole="button"
            accessibilityLabel={date}
            accessibilityState={{ selected: isSelected }}
            className={`flex-1 items-center py-2.5 rounded-xl ${
              isSelected
                ? "bg-brand"
                : today
                  ? "bg-brand/10 active:bg-brand/20"
                  : "active:bg-elevated"
            }`}
          >
            <Text
              className={`text-[9px] font-bold tracking-widest ${
                isSelected ? "text-white/70" : today ? "text-brand/70" : "text-ink-muted"
              }`}
            >
              {abbr}
            </Text>
            <Text
              className={`text-[15px] font-bold leading-tight mt-0.5 ${
                isSelected ? "text-white" : today ? "text-brand" : "text-ink"
              }`}
            >
              {num}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
