import { View, Text, ScrollView, Pressable } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView } from "react-native-safe-area-context"
import { ClockWidget } from "@/components/shifts/ClockWidget"
import { LoadingState } from "@/components/feedback/LoadingState"
import { useMyShifts } from "@/hooks/useShifts"
import { useCurrentUser } from "@/hooks/useEmployee"
import { formatTime, shiftDuration, formatDateLong, isToday } from "@/lib/utils"
import { pickShiftQuote } from "@skemaka/types"

export default function ShiftDetailScreen() {
  const router = useRouter()
  const { id, week } = useLocalSearchParams<{ id: string; week: string }>()

  const { data: shifts, isLoading } = useMyShifts(week)
  const shift = shifts?.find((s) => s.id === id)
  const { data: currentUser } = useCurrentUser()

  if (isLoading) return <LoadingState label="Loading shift…" />

  if (!shift) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        className="flex-1 bg-base items-center justify-center px-8"
      >
        <Text className="text-ink-secondary text-center mb-4">Shift details not available.</Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="active:opacity-60"
        >
          <Text className="text-brand font-semibold">Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const isShiftToday = isToday(shift.date)
  const duration = shiftDuration(shift.startTime, shift.endTime, shift.breakMinutes)

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-base">
      <View className="px-4 pt-2 pb-3 flex-row items-center gap-3 border-b border-line/40">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to shifts"
          className="w-9 h-9 rounded-xl bg-elevated items-center justify-center active:opacity-60"
        >
          <Ionicons name="chevron-back" size={18} color="#7B6EF8" importantForAccessibility="no" />
        </Pressable>
        <Text className="text-base font-semibold text-ink flex-1">
          {formatDateLong(shift.date)}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-5 gap-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Time block */}
        <View className="bg-surface border border-line/60 rounded-2xl p-5 gap-4">
          <View>
            <Text className="text-xs font-medium text-ink-secondary uppercase tracking-wide mb-1">
              Time
            </Text>
            <Text className="text-3xl font-bold text-ink tracking-tight">
              {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
            </Text>
          </View>
          <View className="flex-row gap-6">
            <View>
              <Text className="text-xs text-ink-muted mb-0.5">Duration</Text>
              <Text className="text-base font-semibold text-ink">{duration}</Text>
            </View>
            {shift.breakMinutes > 0 && (
              <View>
                <Text className="text-xs text-ink-muted mb-0.5">Break</Text>
                <Text className="text-base font-semibold text-ink">{shift.breakMinutes} min</Text>
              </View>
            )}
          </View>
        </View>

        {/* Role */}
        <View className="bg-surface border border-line/60 rounded-2xl px-4 py-4">
          <Text className="text-xs font-medium text-ink-secondary uppercase tracking-wide mb-1">
            Role
          </Text>
          <Text className="text-base font-semibold text-ink">{shift.jobRole}</Text>
        </View>

        {/* Notes — the manager's note, or a friendly fallback line */}
        <View className="bg-surface border border-line/60 rounded-2xl px-4 py-4">
          <Text className="text-xs font-medium text-ink-secondary uppercase tracking-wide mb-1">
            Notes
          </Text>
          {shift.notes ? (
            <Text className="text-sm text-ink leading-relaxed">{shift.notes}</Text>
          ) : (
            <Text className="text-sm italic text-ink-muted leading-relaxed">
              &ldquo;{pickShiftQuote(shift.id, currentUser?.industry)}&rdquo;
            </Text>
          )}
        </View>

        {/* Clock in/out widget — today's shift only */}
        {isShiftToday && <ClockWidget todayShift={shift} />}
      </ScrollView>
    </SafeAreaView>
  )
}
