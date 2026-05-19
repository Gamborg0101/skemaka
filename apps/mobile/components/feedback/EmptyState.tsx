import { View, Text } from "react-native"
import { Button } from "@/components/ui/Button"

type Props = {
  icon?: string
  title: string
  description?: string
  action?: { label: string; onPress: () => void }
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      {icon ? <Text className="text-4xl">{icon}</Text> : null}
      <View className="items-center gap-1.5">
        <Text className="text-base font-semibold text-ink">{title}</Text>
        {description ? (
          <Text className="text-sm text-ink-secondary text-center leading-relaxed">{description}</Text>
        ) : null}
      </View>
      {action && (
        <Button variant="secondary" size="sm" onPress={action.onPress}>
          {action.label}
        </Button>
      )}
    </View>
  )
}
