import { Redirect } from "expo-router"
import { ActivityIndicator, View } from "react-native"
import { useAuthStore } from "@/store/authStore"

export default function Index() {
  const { token, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#141417" }}>
        <ActivityIndicator color="#7B6EF8" />
      </View>
    )
  }

  return <Redirect href={token ? "/(tabs)/shifts" : "/(auth)/login"} />
}
