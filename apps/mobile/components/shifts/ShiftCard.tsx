import { Pressable, View, Text } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { formatTime, shiftDuration, isToday } from "@/lib/utils"
import type { Shift } from "@skemaka/types"

type Props = {
  shift: Shift
  onPress?: () => void
  compact?: boolean
}

export function ShiftCard({ shift, onPress, compact = false }: Props) {
  const today = isToday(shift.date)
  const start = formatTime(shift.startTime)
  const end   = formatTime(shift.endTime)
  const hours = shiftDuration(shift.startTime, shift.endTime, shift.breakMinutes)

  const borderClass = today ? "border-brand/50" : "border-line/60"
  const bgClass     = today ? "bg-surface"      : "bg-surface"

  async function handlePress() {
    await Haptics.selectionAsync()
    onPress?.()
  }

  const inner = (
    <View className={`${bgClass} border ${borderClass} rounded-2xl p-4`}>
      {today && (
        <View className="flex-row items-center gap-1.5 mb-2.5">
          <View className="w-1.5 h-1.5 rounded-full bg-brand" />
          <Text className="text-xs font-semibold text-brand tracking-wide uppercase">Today</Text>
        </View>
      )}

      <View className="flex-row items-center justify-between">
        <View className="flex-1 gap-0.5 pr-3">
          <Text className="text-[15px] font-semibold text-ink leading-snug">
            {start} – {end}
          </Text>
          <Text className="text-sm text-ink-secondary">{shift.jobRole}</Text>
        </View>

        <View className="items-end gap-1">
          <View className="bg-elevated rounded-lg px-2.5 py-1">
            <Text className="text-sm font-semibold text-ink">{hours}</Text>
          </View>
          {onPress ? (
            <Ionicons name="chevron-forward" size={14} color="#4A4A57" />
          ) : null}
        </View>
      </View>

      {!compact && shift.notes ? (
        <View className="mt-3 pt-3 border-t border-line/40">
          <Text className="text-sm text-ink-secondary leading-relaxed">{shift.notes}</Text>
        </View>
      ) : null}
    </View>
  )

  if (!onPress) return inner

  return (
    <Pressable onPress={() => void handlePress()} className="active:opacity-75">
      {inner}
    </Pressable>
  )
}
