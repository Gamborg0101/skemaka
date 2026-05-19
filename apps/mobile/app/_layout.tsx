import "../global.css"
import { useEffect } from "react"
import { Slot, useRouter, useSegments } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { QueryClientProvider } from "@tanstack/react-query"
import { ApiClientProvider } from "@skemaka/api"
import { queryClient } from "@/lib/queryClient"
import { apiClient } from "@/lib/apiClient"
import { useAuthStore } from "@/store/authStore"
import { ErrorBoundary } from "@/components/ErrorBoundary"

function AuthGate() {
  const { token, isLoading } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    const inAuth = segments[0] === "(auth)"
    if (!token && !inAuth) router.replace("/(auth)/login")
    if (token && inAuth) router.replace("/(tabs)/shifts")
  }, [token, isLoading, segments, router])

  return <Slot />
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <ApiClientProvider client={apiClient}>
              <StatusBar style="light" />
              <AuthGate />
            </ApiClientProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
