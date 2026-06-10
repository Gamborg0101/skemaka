import { Modal, FlatList, Pressable, View, Text } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { formatTime } from "@/lib/utils"
import { useReducedMotion } from "@/hooks/useReducedMotion"

export const TIME_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? "00" : "30"
  return `${String(h).padStart(2, "0")}:${m}`
})

type Props = {
  visible: boolean
  title: string
  selected: string
  onSelect: (time: string) => void
  onClose: () => void
  minTime?: string
  maxTime?: string
}

export function TimePickerModal({ visible, title, selected, onSelect, onClose, minTime, maxTime }: Props) {
  const reduceMotion = useReducedMotion()
  const slots = minTime || maxTime
    ? TIME_SLOTS.filter((t) => (!minTime || t >= minTime) && (!maxTime || t <= maxTime))
    : TIME_SLOTS
  const initialIndex = Math.max(0, slots.indexOf(selected))

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? "fade" : "slide"}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-base">
        <View className="flex-row items-center px-4 py-3 border-b border-line/40">
          <View className="w-8" />
          <Text className="flex-1 text-center text-base font-semibold text-ink">{title}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="w-8 h-8 items-center justify-center active:opacity-60"
          >
            <Ionicons name="close" size={20} color="#A1A1AE" importantForAccessibility="no" />
          </Pressable>
        </View>

        <FlatList
          data={slots}
          keyExtractor={(t) => t}
          showsVerticalScrollIndicator={false}
          initialScrollIndex={Math.max(0, initialIndex - 3)}
          getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
          renderItem={({ item }) => {
            const isSelected = item === selected
            return (
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync()
                  onSelect(item)
                  onClose()
                }}
                accessibilityRole="button"
                accessibilityLabel={formatTime(item)}
                accessibilityState={{ selected: isSelected }}
                className={`px-6 h-[52px] justify-center border-b border-line/20 active:bg-elevated ${
                  isSelected ? "bg-brand/10" : ""
                }`}
              >
                <Text className={`text-base ${isSelected ? "font-bold text-brand" : "text-ink"}`}>
                  {formatTime(item)}
                </Text>
              </Pressable>
            )
          }}
        />
      </SafeAreaView>
    </Modal>
  )
}
