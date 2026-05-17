"use client"

import React from "react"
import { BugReportDialog } from "@/components/manager/BugReportDialog"
import { Button } from "@/components/ui/button"
import { Bug } from "lucide-react"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  dialogOpen: boolean
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, dialogOpen: false }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(): void {
    // Error is reported via BugReportDialog when user chooses to submit
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const error = this.state.error
      const url = typeof window !== "undefined" ? window.location.href : undefined

      return (
        <div className="flex flex-1 flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="max-w-md w-full space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
              <p className="text-sm text-gray-500">
                An unexpected error occurred. You can report this to help us fix it.
              </p>
            </div>

            <div className="rounded-md bg-gray-100 p-4 text-left">
              <p className="text-xs text-gray-500 font-medium mb-1">Error</p>
              <code className="text-sm text-gray-800 break-all">{error.message}</code>
            </div>

            <div className="flex flex-col items-center gap-3 w-full">
              <Button
                variant="default"
                className="w-full"
                onClick={() => this.setState({ dialogOpen: true })}
              >
                <Bug className="size-4 mr-2" />
                Report this bug
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Reload page
              </Button>
            </div>
          </div>

          {this.state.dialogOpen && (
            <BugReportDialog
              prefillError={{
                message: error.message,
                stack: error.stack,
                url,
              }}
              defaultOpen={true}
              onClose={() => this.setState({ dialogOpen: false })}
            />
          )}
        </div>
      )
    }

    return this.props.children
  }
}
