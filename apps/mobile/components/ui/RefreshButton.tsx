import { Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"

type Props = {
  onPress: () => void
  isRefreshing?: boolean
}

export function RefreshButton({ onPress, isRefreshing = false }: Props) {
  return (
    <Pressable
      onPress={() => { void Haptics.selectionAsync(); onPress() }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Refresh"
      className="w-9 h-9 items-center justify-center rounded-full active:opacity-50"
      style={{ backgroundColor: isRefreshing ? "rgba(123,110,248,0.12)" : "rgba(255,255,255,0.05)" }}
    >
      <Ionicons
        name="refresh"
        size={18}
        color={isRefreshing ? "#7B6EF8" : "#6B6B7B"}
        importantForAccessibility="no"
      />
    </Pressable>
  )
}
