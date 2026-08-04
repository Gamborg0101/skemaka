"use client"

import { useState } from "react"
import { BookOpen, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip } from "@/components/ui/tooltip"
import { TimePicker } from "@/components/manager/TimePicker"
import { formatTime } from "@/lib/dateUtils"
import { getOrgSettings } from "@/lib/orgSettings"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { useOrg } from "@/lib/orgContext"
import { useOptimisticList } from "@/lib/useOptimisticList"
import type { ShiftTemplate } from "@/types"
import { SettingsSection } from "./SettingsSection"

const BREAK_OPTIONS = [
  { label: "No break", value: "0" },
  { label: "15 min", value: "15" },
  { label: "30 min", value: "30" },
  { label: "45 min", value: "45" },
  { label: "60 min", value: "60" },
]

function formatTemplateSummary(t: ShiftTemplate) {
  const tf = getOrgSettings().timeFormat
  const times = `${formatTime(t.startTime, tf)}–${formatTime(t.endTime, tf)}`
  const brk = t.breakMinutes > 0 ? ` · ${t.breakMinutes}m break` : ""
  const role = t.jobRole ? ` · ${t.jobRole}` : ""
  return `${times}${brk}${role}`
}

export function ShiftTypesSection() {
  const tToast = useTranslations("manager.toasts")
  const { orgId, jobRoles, shiftTemplates, setShiftTemplates } = useOrg()
  const { remove: removeTemplate } = useOptimisticList(shiftTemplates, setShiftTemplates)

  const [showAddForm, setShowAddForm] = useState(false)
  const [addName, setAddName] = useState("")
  const [addStart, setAddStart] = useState("09:00")
  const [addEnd, setAddEnd] = useState("17:00")
  const [addBreak, setAddBreak] = useState("30")
  const [addRole, setAddRole] = useState("")
  const [addSaving, setAddSaving] = useState(false)

  function resetAddForm() {
    setAddName("")
    setAddStart("09:00")
    setAddEnd("17:00")
    setAddBreak("30")
    setAddRole("")
    setShowAddForm(false)
  }

  async function handleAddTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!addName.trim()) return
    setAddSaving(true)
    try {
      const colorTag = jobRoles.find((r) => r.name === addRole)?.color ?? null
      const r = await fetch(`/api/orgs/${orgId}/shift-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName.trim(),
          startTime: addStart,
          endTime: addEnd,
          breakMinutes: parseInt(addBreak, 10),
          jobRole: addRole,
          colorTag,
        }),
      })
      const data = await r.json() as { data?: ShiftTemplate; error?: string }
      if (!r.ok) throw new Error(data.error ?? "Failed to save")
      setShiftTemplates((prev) => [...prev, data.data!])
      resetAddForm()
      toast.success(`"${data.data!.name}" shift type added`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save shift type")
    } finally {
      setAddSaving(false)
    }
  }

  async function handleDeleteTemplate(tmpl: ShiftTemplate) {
    await removeTemplate(tmpl.id, async () => {
      const r = await fetch(`/api/orgs/${orgId}/shift-templates/${tmpl.id}`, { method: "DELETE" })
      if (!r.ok) { toast.error(tToast("shiftTypeDeleteFailed")); throw new Error() }
      toast.success(`"${tmpl.name}" deleted`)
    })
  }

  return (
    <SettingsSection icon={BookOpen} title="Shift Types" description="Presets you can apply with one click when adding a shift.">
      <div className="mt-4">
        {showAddForm ? (
          <form onSubmit={handleAddTemplate} className="mb-3 p-4 rounded-lg border border-blue-100 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-950/30 space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">New shift type</p>
            <div className="space-y-1.5">
              <Label htmlFor="tmpl-name" className="text-xs">Name</Label>
              <Input
                id="tmpl-name"
                placeholder="e.g. Morning Kitchen"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="h-8 text-sm"
                autoFocus
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start time</Label>
                <TimePicker value={addStart} onChange={setAddStart} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End time</Label>
                <TimePicker value={addEnd} onChange={setAddEnd} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Break</Label>
                <Select value={addBreak} onValueChange={(v) => { if (v) setAddBreak(v) }}>
                  <SelectTrigger className="h-8 text-sm w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BREAK_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Job role (optional)</Label>
                <Select value={addRole} onValueChange={(v) => setAddRole(v ?? "")}>
                  <SelectTrigger className="h-8 text-sm w-full">
                    <SelectValue placeholder="Any role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any role</SelectItem>
                    {jobRoles.map((r) => (
                      <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={resetAddForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={addSaving || !addName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {addSaving ? "Saving…" : "Save shift type"}
              </Button>
            </div>
          </form>
        ) : null}

        {shiftTemplates.length === 0 && !showAddForm ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No shift types yet. Add one to speed up scheduling.
          </p>
        ) : shiftTemplates.length > 0 ? (
          <div className="space-y-1 mb-3">
            {shiftTemplates.map((tmpl) => (
              <div key={tmpl.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{tmpl.name}</span>
                  <span className="text-sm text-gray-400 ml-2">{formatTemplateSummary(tmpl)}</span>
                </div>
                <Tooltip content="Delete shift type">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteTemplate(tmpl)}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-950/40 shrink-0"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </Tooltip>
              </div>
            ))}
          </div>
        ) : null}

        {!showAddForm && (
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="size-3.5 mr-1" />
            Add shift type
          </Button>
        )}
      </div>
    </SettingsSection>
  )
}
