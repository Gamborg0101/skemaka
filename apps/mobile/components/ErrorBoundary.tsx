import React, { Component, type ReactNode, type ErrorInfo } from "react"
import { Text, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslations } from "@/lib/i18n"

type Props = { children: ReactNode }
type State = { error: Error | null; resetKey: number }

/**
 * The fallback lives in its own function component because an error boundary
 * must be a class, and hooks cannot run in one. Rendering it as an element means
 * the copy is translated while the boundary itself stays a class.
 *
 * `I18nProvider` sits ABOVE the boundary in app/_layout.tsx precisely so this
 * still has a locale to read when everything below has crashed.
 */
function ErrorFallback({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTranslations("mobile")

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      className="flex-1 bg-base items-center justify-center px-8"
    >
      <Text className="text-4xl mb-4">⚠️</Text>
      <Text className="text-base font-semibold text-ink text-center mb-2">
        {t("state.somethingWentWrong")}
      </Text>
      <Text className="text-sm text-ink-secondary text-center leading-relaxed mb-6">
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t("state.tryAgain")}
        className="bg-brand px-6 py-3 rounded-2xl active:opacity-80"
      >
        <Text className="text-white font-semibold text-sm">{t("state.tryAgain")}</Text>
      </Pressable>
    </SafeAreaView>
  )
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // TODO: wire to Sentry / Crashlytics when added
    console.error("[ErrorBoundary]", error.message, info.componentStack)
  }

  handleRetry = () => {
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }))
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback message={this.state.error.message} onRetry={this.handleRetry} />
      )
    }
    // Increment key forces full remount of children when retrying, preventing
    // immediate re-throw from the same render-phase error.
    return (
      <React.Fragment key={this.state.resetKey}>
        {this.props.children}
      </React.Fragment>
    )
  }
}
