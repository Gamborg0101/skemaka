"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { AlertTriangle, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useOrg } from "@/lib/orgContext"
import { SettingsSection } from "./SettingsSection"

const CONFIRM_WORD = "DELETE"

export function DeleteAccountSection() {
  const { org } = useOrg()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const r = await fetch("/api/me/account", { method: "DELETE" })
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? "Failed to delete account")
      }
      // Signed-out redirect to the landing page — the account no longer exists.
      await signOut({ redirectTo: "/" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account")
      setDeleting(false)
    }
  }

  return (
    <SettingsSection
      icon={Trash2}
      title="Delete account"
      description="Permanently delete your account and workspace."
    >
      <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-300">
          <AlertTriangle className="size-4 shrink-0" /> This can&apos;t be undone
        </p>
        <p className="mt-2 text-sm text-red-700/90 dark:text-red-300/80">
          Deleting your account permanently removes{" "}
          <span className="font-medium">{org?.name ? `“${org.name}”` : "your workspace"}</span>{" "}
          and everything in it:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-red-700/90 dark:text-red-300/80">
          <li>• Every employee and their access</li>
          <li>• All schedules, shifts and history</li>
          <li>• Availability, time-off and cover requests</li>
          <li>• Any active subscription (billing stops)</li>
        </ul>
        <Button
          onClick={() => { setConfirmText(""); setOpen(true) }}
          className="mt-4 bg-red-600 hover:bg-red-700 text-white"
          size="sm"
        >
          <Trash2 className="size-4" /> Delete account
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!deleting) setOpen(v) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-gray-900 dark:text-gray-100">{org?.name ?? "your workspace"}</span>,
              every employee, and all schedules and shifts. It cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label htmlFor="confirm-delete" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Type <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{CONFIRM_WORD}</span> to confirm
            </label>
            <input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder={CONFIRM_WORD}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || confirmText.trim() !== CONFIRM_WORD}
            >
              {deleting ? "Deleting…" : "Delete everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  )
}
