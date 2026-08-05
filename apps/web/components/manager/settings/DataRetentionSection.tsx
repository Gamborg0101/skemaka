"use client"

import { useState } from "react"
import { Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { useOrg } from "@/lib/orgContext"
import { RETENTION } from "@/lib/cleanupConfig"
import type { CleanupPreview } from "@/lib/cleanupConfig"
import { SettingsSection } from "./SettingsSection"

export function DataRetentionSection() {
  const tToast = useTranslations("manager.toasts")
  const tSettings = useTranslations("manager.settings")
  const tCommon = useTranslations("common")
  const { orgId } = useOrg()
  const [preview, setPreview] = useState<CleanupPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState<CleanupPreview | null>(null)

  async function handlePreview() {
    setPreviewing(true)
    setDone(null)
    try {
      const r = await fetch(`/api/orgs/${orgId}/cleanup`)
      const data = await r.json() as { data?: CleanupPreview }
      setPreview(data.data ?? null)
    } catch {
      toast.error(tToast("cleanupPreviewFailed"))
    } finally {
      setPreviewing(false)
    }
  }

  async function handleRun() {
    setRunning(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}/cleanup`, { method: "DELETE" })
      const data = await r.json() as { data?: CleanupPreview }
      setDone(data.data ?? null)
      setPreview(null)
      toast.success(tToast("cleanupComplete"))
    } catch {
      toast.error(tToast("cleanupFailed"))
    } finally {
      setRunning(false)
    }
  }

  const deletedParts = done
    ? [
        done.schedules > 0 && tSettings("dataRetention.unitSchedules", { n: done.schedules }),
        done.availability > 0 && tSettings("dataRetention.unitAvailability", { n: done.availability }),
        done.events > 0 && tSettings("dataRetention.unitEvents", { n: done.events }),
      ].filter(Boolean)
    : []

  return (
    <SettingsSection icon={Archive} title={tSettings("dataRetention.title")} description={tSettings("dataRetention.description")}>
      <div className="mt-4 space-y-4">
        <ul className="space-y-1.5">
          {/* The cutoffs still come from RETENTION so the copy can never claim
              a different number from the one cleanup actually uses; only the
              sentence around them is translated. */}
          {([
            ["itemSchedules", RETENTION.schedules.months],
            ["itemAvailability", RETENTION.availability.months],
            ["itemEvents", RETENTION.events.months],
          ] as const).map(([key, months]) => (
            <li key={key} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="size-1.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
              {tSettings(`dataRetention.${key}`, { months })}
            </li>
          ))}
          <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="size-1.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
            {tSettings("dataRetention.expiredSessions")}
          </li>
        </ul>

        <p className="text-xs text-gray-400">
          {tSettings("dataRetention.autoCleanupNote")}
        </p>

        {done && (
          <div className="rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/50 px-4 py-3 text-sm text-green-800 dark:text-green-300">
            {done.total === 0 ? (
              tSettings("dataRetention.nothingToCleanDone")
            ) : (
              <>
                {tSettings("dataRetention.deletedPrefix")} {deletedParts.join(", ")}.
              </>
            )}
          </div>
        )}

        {preview && !done && (
          <div className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            preview.total === 0
              ? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
              : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-300"
          )}>
            {preview.total === 0 ? (
              tSettings("dataRetention.nothingToCleanPreview")
            ) : (
              <div className="space-y-1">
                <p className="font-medium">{tSettings("dataRetention.readyToDelete")}</p>
                {preview.schedules > 0 && (
                  <p>{tSettings("dataRetention.previewSchedules", { n: preview.schedules })}</p>
                )}
                {preview.availability > 0 && (
                  <p>{tSettings("dataRetention.previewAvailability", { n: preview.availability })}</p>
                )}
                {preview.events > 0 && (
                  <p>{tSettings("dataRetention.previewEvents", { n: preview.events })}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {!preview && !done && (
            <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewing}>
              {previewing ? tSettings("dataRetention.checking") : tSettings("dataRetention.previewCleanup")}
            </Button>
          )}
          {preview && preview.total > 0 && !done && (
            <>
              <Button
                size="sm"
                onClick={handleRun}
                disabled={running}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {running ? tSettings("dataRetention.running") : tSettings("dataRetention.deleteRecordsBtn", { n: preview.total })}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPreview(null)} disabled={running}>
                {tCommon("cancel")}
              </Button>
            </>
          )}
          {(preview?.total === 0 || done) && (
            <Button variant="outline" size="sm" onClick={() => { setPreview(null); setDone(null) }}>
              {tSettings("dataRetention.reset")}
            </Button>
          )}
        </div>
      </div>
    </SettingsSection>
  )
}
