import { View, Text } from "react-native"
import { Button } from "@/components/ui/Button"

type Props = {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = "Something went wrong.", onRetry }: Props) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <Text className="text-3xl">⚠️</Text>
      <View className="items-center gap-1">
        <Text className="text-base font-semibold text-ink">Error</Text>
        <Text className="text-sm text-ink-secondary text-center">{message}</Text>
      </View>
      {onRetry && (
        <Button variant="secondary" size="sm" onPress={onRetry}>
          Try again
        </Button>
      )}
    </View>
  )
}
