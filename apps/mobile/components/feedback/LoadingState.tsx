import { View, ActivityIndicator, Text } from "react-native"

type Props = {
  label?: string
  full?: boolean
}

export function LoadingState({ label, full = true }: Props) {
  return (
    <View className={`items-center justify-center gap-3 ${full ? "flex-1" : "py-12"}`}>
      <ActivityIndicator size="large" color="#7B6EF8" />
      {label ? <Text className="text-sm text-ink-secondary">{label}</Text> : null}
    </View>
  )
}
