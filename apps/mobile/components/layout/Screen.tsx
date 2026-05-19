import { ScrollView, View, RefreshControl, type ViewProps } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

type Props = ViewProps & {
  scroll?: boolean
  padded?: boolean
  edges?: ("top" | "bottom" | "left" | "right")[]
  onRefresh?: () => void
  refreshing?: boolean
}

export function Screen({
  scroll = false,
  padded = true,
  edges = ["top", "bottom"],
  onRefresh,
  refreshing = false,
  className = "",
  children,
  ...props
}: Props) {
  const px = padded ? "px-4" : ""

  if (scroll) {
    return (
      <SafeAreaView edges={edges} className="flex-1 bg-base">
        <ScrollView
          className="flex-1"
          contentContainerClassName={`grow ${px} py-4`}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#7B6EF8"
                colors={["#7B6EF8"]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={edges} className="flex-1 bg-base">
      <View className={`flex-1 ${px} ${className}`} {...props}>
        {children}
      </View>
    </SafeAreaView>
  )
}
