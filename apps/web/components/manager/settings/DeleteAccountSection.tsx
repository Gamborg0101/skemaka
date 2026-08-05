"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { AlertTriangle, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useOrg } from "@/lib/orgContext"
import { SettingsSection } from "./SettingsSection"

const CONFIRM_WORD = "DELETE"

export function DeleteAccountSection() {
  const tSettings = useTranslations("manager.settings")
  const tCommon = useTranslations("common")
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
        throw new Error(data.error ?? tSettings("deleteAccount.deleteFailed"))
      }
      // Signed-out redirect to the landing page — the account no longer exists.
      await signOut({ redirectTo: "/" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tSettings("deleteAccount.deleteFailed"))
      setDeleting(false)
    }
  }

  const workspaceName = org?.name ? `“${org.name}”` : tSettings("deleteAccount.yourWorkspace")
  const dialogWorkspaceName = org?.name ?? tSettings("deleteAccount.yourWorkspace")

  return (
    <SettingsSection
      icon={Trash2}
      title={tSettings("deleteAccount.title")}
      description={tSettings("deleteAccount.description")}
    >
      <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-300">
          <AlertTriangle className="size-4 shrink-0" /> {tSettings("deleteAccount.cantUndo")}
        </p>
        <p className="mt-2 text-sm text-red-700/90 dark:text-red-300/80">
          {tSettings.rich("deleteAccount.removesIntro", {
            name: workspaceName,
            strong: (chunks) => <span className="font-medium">{chunks}</span>,
          })}
        </p>
        <ul className="mt-2 space-y-1 text-sm text-red-700/90 dark:text-red-300/80">
          <li>• {tSettings("deleteAccount.listEmployees")}</li>
          <li>• {tSettings("deleteAccount.listSchedules")}</li>
          <li>• {tSettings("deleteAccount.listAvailability")}</li>
          <li>• {tSettings("deleteAccount.listBilling")}</li>
        </ul>
        <Button
          onClick={() => { setConfirmText(""); setOpen(true) }}
          className="mt-4 bg-red-600 hover:bg-red-700 text-white"
          size="sm"
        >
          <Trash2 className="size-4" /> {tSettings("deleteAccount.title")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!deleting) setOpen(v) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tSettings("deleteAccount.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {tSettings.rich("deleteAccount.dialogDesc", {
                name: dialogWorkspaceName,
                strong: (chunks) => (
                  <span className="font-medium text-gray-900 dark:text-gray-100">{chunks}</span>
                ),
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label htmlFor="confirm-delete" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {tSettings.rich("deleteAccount.confirmLabel", {
                word: CONFIRM_WORD,
                code: (chunks) => (
                  <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{chunks}</span>
                ),
              })}
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
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || confirmText.trim() !== CONFIRM_WORD}
            >
              {deleting ? tSettings("deleteAccount.deleting") : tSettings("deleteAccount.deleteEverything")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  )
}
