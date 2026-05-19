import { useState } from "react"
import { View, Text, Alert } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import * as WebBrowser from "expo-web-browser"
import * as Linking from "expo-linking"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button } from "@/components/ui/Button"
import { useAuthStore } from "@/store/authStore"
import { API_URL } from "@/lib/constants"

WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen() {
  const [loading, setLoading] = useState(false)
  const signIn = useAuthStore((s) => s.signIn)

  async function handleLogin() {
    setLoading(true)
    try {
      const callbackUrl = Linking.createURL("/auth/callback")
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_URL}/api/auth/signin?callbackUrl=${encodeURIComponent(
          `${API_URL}/api/auth/mobile/session?redirect=${encodeURIComponent(callbackUrl)}`,
        )}`,
        callbackUrl,
      )

      if (result.type !== "success") return

      const url = new URL(result.url)
      const token = url.searchParams.get("token")

      if (!token) {
        Alert.alert("Login failed", "Could not retrieve session. Please try again.")
        return
      }

      await signIn(token)
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-base">
      <LinearGradient
        colors={["#1C1032", "#0C0C0F"]}
        locations={[0, 0.55]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Brand glow */}
      <View
        style={{
          position: "absolute",
          top: -80,
          alignSelf: "center",
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: "rgba(123, 110, 248, 0.12)",
        }}
      />

      <SafeAreaView className="flex-1 px-6 justify-between py-10">
        {/* Top — logo */}
        <View className="items-center pt-16 gap-3">
          <View className="w-16 h-16 rounded-2xl bg-brand/20 border border-brand/30 items-center justify-center">
            <Text className="text-3xl">📅</Text>
          </View>
          <View className="items-center gap-1">
            <Text className="text-3xl font-bold text-ink tracking-tight">Skemaka</Text>
            <Text className="text-base text-ink-secondary">Your shifts, always with you</Text>
          </View>
        </View>

        {/* Bottom — sign in */}
        <View className="gap-4">
          <View className="gap-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              onPress={() => void handleLogin()}
            >
              Continue with Google
            </Button>
            <Text className="text-xs text-ink-muted text-center">
              Your manager sends an invite link to get started.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}
