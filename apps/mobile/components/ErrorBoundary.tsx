import React, { Component, type ReactNode, type ErrorInfo } from "react"
import { View, Text, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

type Props = { children: ReactNode }
type State = { error: Error | null; resetKey: number }

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
        <SafeAreaView
          edges={["top", "bottom"]}
          className="flex-1 bg-base items-center justify-center px-8"
        >
          <Text className="text-4xl mb-4">⚠️</Text>
          <Text className="text-base font-semibold text-ink text-center mb-2">
            Something went wrong
          </Text>
          <Text className="text-sm text-ink-secondary text-center leading-relaxed mb-6">
            {this.state.error.message}
          </Text>
          <Pressable
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            className="bg-brand px-6 py-3 rounded-2xl active:opacity-80"
          >
            <Text className="text-white font-semibold text-sm">Try again</Text>
          </Pressable>
        </SafeAreaView>
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
