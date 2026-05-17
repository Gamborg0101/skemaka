"use client"

import { useEffect, useState } from "react"
import { Bug } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

interface BugReportDialogProps {
  prefillError?: { message: string; stack?: string; component?: string; url?: string }
  defaultOpen?: boolean
  onClose?: () => void
}

export function BugReportDialog({ prefillError, defaultOpen = false, onClose }: BugReportDialogProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  // Sync defaultOpen changes (e.g. error boundary mounts with defaultOpen=true)
  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) onClose?.()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // For error reports without a user message, allow submitting with just error data
    const hasContent = prefillError || message.trim().length >= 5
    if (!hasContent) return
    setSending(true)
    try {
      const body: Record<string, string | undefined> = { message }
      if (prefillError) {
        body.errorMessage = prefillError.message
        body.errorStack = prefillError.stack
        body.component = prefillError.component
        body.url = prefillError.url ?? (typeof window !== "undefined" ? window.location.href : undefined)
      }
      const res = await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success("Bug report sent — thanks!")
      setMessage("")
      handleOpenChange(false)
    } catch {
      toast.error("Failed to send. Please try again.")
    } finally {
      setSending(false)
    }
  }

  const canSubmit = prefillError ? true : message.trim().length >= 5

  return (
    <>
      {!prefillError && (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 lg:px-3 py-2 text-sm text-gray-500 hover:bg-white/8 hover:text-gray-300 transition-colors justify-center lg:justify-start"
          title="Report a bug"
        >
          <Bug className="size-4 shrink-0" />
          <span className="hidden lg:block">Report a bug</span>
        </button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report a bug</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {prefillError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-xs font-medium text-red-700 mb-1">Error detected</p>
                <p className="text-sm text-red-800 font-mono break-all">{prefillError.message}</p>
              </div>
            )}
            <Textarea
              placeholder={
                prefillError
                  ? "Optional: describe what you were doing when this happened…"
                  : "Describe what happened and how to reproduce it…"
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="resize-none"
              autoFocus
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={sending || !canSubmit}
              >
                {sending ? "Sending…" : "Send report"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
