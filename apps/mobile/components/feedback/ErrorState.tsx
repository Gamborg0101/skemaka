import { View, Text } from "react-native"
import { Button } from "@/components/ui/Button"
import { useTranslations } from "@/lib/i18n"

type Props = {
  /** Already-translated text — callers own their own copy. */
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: Props) {
  const t = useTranslations("mobile")

  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <Text className="text-3xl">⚠️</Text>
      <View className="items-center gap-1">
        <Text className="text-base font-semibold text-ink">{t("state.error")}</Text>
        <Text className="text-sm text-ink-secondary text-center">
          {message ?? t("state.somethingWentWrong")}
        </Text>
      </View>
      {onRetry && (
        <Button variant="secondary" size="sm" onPress={onRetry}>
          {t("state.tryAgain")}
        </Button>
      )}
    </View>
  )
}
