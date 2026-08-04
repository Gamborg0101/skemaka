import "../global.css"
import { useEffect } from "react"
import { Slot, useRouter, useSegments } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { QueryClientProvider } from "@tanstack/react-query"
import { ApiClientProvider } from "@skemaka/api"
import * as SplashScreen from "expo-splash-screen"
import { queryClient } from "@/lib/queryClient"
import { apiClient } from "@/lib/apiClient"
import { useAuthStore } from "@/store/authStore"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { I18nProvider } from "@/lib/i18n"

// Keep the splash screen visible until the auth store hydrates.
SplashScreen.preventAutoHideAsync()

function AuthGate() {
  const { token, isLoading } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  // Derive a stable string from the segments array so this effect only fires
  // when the first segment actually changes — not on every navigation event
  // (which would create a new array reference each time).
  const segment = segments[0]

  useEffect(() => {
    if (isLoading) return
    // segment is undefined while expo-router is still resolving the initial
    // route or during transition frames — let index.tsx's <Redirect> handle
    // the first navigation; only act once we have a real segment.
    if (segment === undefined) return
    const inAuth = segment === "(auth)"
    if (!token && !inAuth) router.replace("/(auth)/login")
    if (token && inAuth) router.replace("/(tabs)/shifts")
  }, [token, isLoading, segment, router]) // router is a stable singleton — included to satisfy exhaustive-deps

  return <Slot />
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate)
  const isLoading = useAuthStore((s) => s.isLoading)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // Hide the splash screen once the auth store has finished loading.
  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync()
    }
  }, [isLoading])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Outside ErrorBoundary so the boundary's own copy is translated. */}
        <I18nProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <ApiClientProvider client={apiClient}>
                <StatusBar style="light" />
                <AuthGate />
              </ApiClientProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
