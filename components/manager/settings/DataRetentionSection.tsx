"use client"

import { useState } from "react"
import { Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useOrg } from "@/lib/orgContext"
import { RETENTION } from "@/lib/cleanupConfig"
import type { CleanupPreview } from "@/lib/cleanupConfig"
import { SettingsSection } from "./SettingsSection"

export function DataRetentionSection() {
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
      toast.error("Failed to load cleanup preview")
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
      toast.success("Cleanup complete")
    } catch {
      toast.error("Cleanup failed")
    } finally {
      setRunning(false)
    }
  }

  return (
    <SettingsSection icon={Archive} title="Data Retention" description="Remove old schedules and availability data to keep the database lean.">
      <div className="mt-4 space-y-4">
        <ul className="space-y-1.5">
          {Object.values(RETENTION).map((r) => (
            <li key={r.label} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="size-1.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
              {r.label}
            </li>
          ))}
          <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="size-1.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
            Expired sessions (cleaned automatically)
          </li>
        </ul>

        <p className="text-xs text-gray-400">
          Cleanup also runs automatically every Sunday at 03:00 UTC.
        </p>

        {done && (
          <div className="rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/50 px-4 py-3 text-sm text-green-800 dark:text-green-300">
            {done.total === 0 ? (
              "Nothing to clean — database is already tidy."
            ) : (
              <>
                Deleted{" "}
                {[
                  done.schedules > 0 && `${done.schedules} schedule${done.schedules !== 1 ? "s" : ""}`,
                  done.availability > 0 && `${done.availability} availability request${done.availability !== 1 ? "s" : ""}`,
                  done.events > 0 && `${done.events} event${done.events !== 1 ? "s" : ""}`,
                ].filter(Boolean).join(", ")}.
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
              "Nothing to clean — everything is within the retention window."
            ) : (
              <div className="space-y-1">
                <p className="font-medium">Ready to delete:</p>
                {preview.schedules > 0 && (
                  <p>{preview.schedules} schedule{preview.schedules !== 1 ? "s" : ""} (+ all their shifts)</p>
                )}
                {preview.availability > 0 && (
                  <p>{preview.availability} availability request{preview.availability !== 1 ? "s" : ""} (+ submissions)</p>
                )}
                {preview.events > 0 && (
                  <p>{preview.events} scheduling event{preview.events !== 1 ? "s" : ""}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {!preview && !done && (
            <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewing}>
              {previewing ? "Checking…" : "Preview cleanup"}
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
                {running ? "Running…" : `Delete ${preview.total} records`}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPreview(null)} disabled={running}>
                Cancel
              </Button>
            </>
          )}
          {(preview?.total === 0 || done) && (
            <Button variant="outline" size="sm" onClick={() => { setPreview(null); setDone(null) }}>
              Reset
            </Button>
          )}
        </div>
      </div>
    </SettingsSection>
  )
}
