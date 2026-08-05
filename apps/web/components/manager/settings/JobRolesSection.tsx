"use client"

import { useState } from "react"
import { Tag, Pencil, Trash2, Plus, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { useOrg } from "@/lib/orgContext"
import { useOptimisticList } from "@/lib/useOptimisticList"
import { ROLE_COLOR_TOKENS, roleColorSwatch } from "@/lib/roleColors"
import type { JobRole } from "@/types"
import { SettingsSection } from "./SettingsSection"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

const DEFAULT_COLOR = ROLE_COLOR_TOKENS[0]

// Palette of named color tokens the schedule can actually render. The stored
// value is the token; the swatch just shows a representative hue.
function ColorPicker({
  value,
  onChange,
  colorNames,
  selectLabel,
}: {
  value: string
  onChange: (color: string) => void
  colorNames: Record<string, string>
  selectLabel: (color: string) => string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ROLE_COLOR_TOKENS.map((token) => {
        const hex = roleColorSwatch(token)
        return (
          <button
            key={token}
            type="button"
            onClick={() => onChange(token)}
            className="size-6 rounded-full border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{
              backgroundColor: hex,
              borderColor: value === token ? "white" : "transparent",
              boxShadow: value === token ? `0 0 0 2px ${hex}` : "none",
            }}
            aria-label={selectLabel(colorNames[token] ?? token)}
          />
        )
      })}
    </div>
  )
}

export function JobRolesSection() {
  const tSettings = useTranslations("manager.settings")
  const tCommon = useTranslations("common")
  const colorNames: Record<string, string> = {
    blue: tSettings("jobRoles.colorNames.blue"),
    green: tSettings("jobRoles.colorNames.green"),
    orange: tSettings("jobRoles.colorNames.orange"),
    purple: tSettings("jobRoles.colorNames.purple"),
    yellow: tSettings("jobRoles.colorNames.yellow"),
    rose: tSettings("jobRoles.colorNames.rose"),
    red: tSettings("jobRoles.colorNames.red"),
    pink: tSettings("jobRoles.colorNames.pink"),
    indigo: tSettings("jobRoles.colorNames.indigo"),
    teal: tSettings("jobRoles.colorNames.teal"),
    cyan: tSettings("jobRoles.colorNames.cyan"),
    gray: tSettings("jobRoles.colorNames.gray"),
  }
  const selectColorLabel = (color: string) => tSettings("jobRoles.selectColorAria", { color })
  const { orgId, jobRoles, setJobRoles } = useOrg()
  const { patch, remove, addOptimistic } = useOptimisticList(jobRoles, setJobRoles)

  // Add form
  const [showAddForm, setShowAddForm] = useState(false)
  // A one-click delete with no prompt, unlike every other destructive action in
  // Settings. The service refuses to delete a role still assigned to anyone, so
  // the blast radius is small — but the inconsistency is the friction.
  const [deleteTarget, setDeleteTarget] = useState<JobRole | null>(null)
  const [addName, setAddName] = useState("")
  const [addColor, setAddColor] = useState<string>(DEFAULT_COLOR)
  const [addSaving, setAddSaving] = useState(false)

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState<string>(DEFAULT_COLOR)
  const [editSaving, setEditSaving] = useState(false)

  function resetAddForm() {
    setAddName("")
    setAddColor(DEFAULT_COLOR)
    setShowAddForm(false)
  }

  function startEdit(role: JobRole) {
    setEditingId(role.id)
    setEditName(role.name)
    setEditColor(role.color)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName("")
    setEditColor(DEFAULT_COLOR)
    setEditSaving(false)
  }

  async function handleAddRole(e: React.FormEvent) {
    e.preventDefault()
    if (!addName.trim()) return
    setAddSaving(true)
    const tempId = `temp-${Date.now()}`
    const tempRole: JobRole = {
      id: tempId,
      name: addName.trim(),
      color: addColor,
      organizationId: orgId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    try {
      await addOptimistic(tempRole, async () => {
        const r = await fetch(`/api/orgs/${orgId}/roles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: addName.trim(), color: addColor }),
        })
        const data = await r.json() as { data?: JobRole; error?: string }
        if (!r.ok) throw new Error(data.error ?? tSettings("jobRoles.saveFailedGeneric"))
        toast.success(tSettings("jobRoles.roleAdded", { name: data.data!.name }))
        resetAddForm()
        return data.data!
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tSettings("jobRoles.addFailed"))
    } finally {
      setAddSaving(false)
    }
  }

  async function handleSaveEdit(role: JobRole) {
    const trimmed = editName.trim()
    if (!trimmed) return
    const nameChanged = trimmed !== role.name
    const colorChanged = editColor !== role.color
    if (!nameChanged && !colorChanged) { cancelEdit(); return }

    const body = {
      ...(nameChanged ? { name: trimmed } : {}),
      ...(colorChanged ? { color: editColor } : {}),
    }
    setEditSaving(true)
    try {
      await patch(role.id, body, async () => {
        const r = await fetch(`/api/orgs/${orgId}/roles/${role.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = await r.json() as { data?: JobRole; error?: string }
        if (!r.ok) throw new Error(data.error ?? tSettings("jobRoles.updateFailedGeneric"))
        toast.success(tSettings("jobRoles.roleUpdated", { name: trimmed }))
        cancelEdit()
        return data.data ?? null
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tSettings("jobRoles.updateFailed"))
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteRole(role: JobRole) {
    await remove(role.id, async () => {
      const r = await fetch(`/api/orgs/${orgId}/roles/${role.id}`, { method: "DELETE" })
      const data = await r.json() as { error?: string }
      if (!r.ok) {
        toast.error(data.error ?? tSettings("jobRoles.deleteFailed"))
        throw new Error()
      }
      toast.success(tSettings("jobRoles.roleDeleted", { name: role.name }))
    })
  }

  return (
    <SettingsSection
      icon={Tag}
      title={tSettings("jobRoles.title")}
      description={tSettings("jobRoles.description")}
    >
      <div className="mt-4">
        {showAddForm ? (
          <form
            onSubmit={handleAddRole}
            className="mb-3 p-4 rounded-lg border border-blue-100 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-950/30 space-y-3"
          >
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{tSettings("jobRoles.newRoleHeading")}</p>
            <div className="space-y-1.5">
              <Label htmlFor="role-name" className="text-xs">{tSettings("jobRoles.nameLabel")}</Label>
              <Input
                id="role-name"
                placeholder={tSettings("jobRoles.namePlaceholder")}
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="h-8 text-sm"
                autoFocus
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tSettings("jobRoles.colorLabel")}</Label>
              <ColorPicker value={addColor} onChange={setAddColor} colorNames={colorNames} selectLabel={selectColorLabel} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={resetAddForm}>
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={addSaving || !addName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {addSaving ? tCommon("saving") : tSettings("jobRoles.saveRole")}
              </Button>
            </div>
          </form>
        ) : null}

        {jobRoles.length === 0 && !showAddForm ? (
          <p className="text-sm text-gray-400 text-center py-4">
            {tSettings("jobRoles.empty")}
          </p>
        ) : jobRoles.length > 0 ? (
          <div className="space-y-1 mb-3">
            {jobRoles.map((role) =>
              editingId === role.id ? (
                <div
                  key={role.id}
                  className="rounded-lg px-3 py-2.5 bg-gray-50 dark:bg-gray-700/40 space-y-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full shrink-0"
                      style={{ backgroundColor: roleColorSwatch(editColor) }}
                    />
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 text-sm flex-1"
                      autoFocus
                      maxLength={100}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleSaveEdit(role) }
                        if (e.key === "Escape") cancelEdit()
                      }}
                    />
                    <Tooltip content={tSettings("jobRoles.saveTooltip")}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleSaveEdit(role)}
                        disabled={editSaving || !editName.trim()}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40 shrink-0"
                      >
                        <Check className="size-3.5" />
                      </Button>
                    </Tooltip>
                    <Tooltip content={tCommon("cancel")}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={cancelEdit}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 shrink-0"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </Tooltip>
                  </div>
                  <ColorPicker value={editColor} onChange={setEditColor} colorNames={colorNames} selectLabel={selectColorLabel} />
                </div>
              ) : (
                <div
                  key={role.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/40"
                >
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: roleColorSwatch(role.color) }}
                  />
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100 min-w-0 truncate">
                    {role.name}
                  </span>
                  <Tooltip content={tSettings("jobRoles.renameTooltip")}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEdit(role)}
                      className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:text-gray-500 dark:hover:text-blue-400 dark:hover:bg-blue-950/40 shrink-0"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </Tooltip>
                  <Tooltip content={tSettings("jobRoles.deleteTooltip")}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(role)}
                      className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-950/40 shrink-0"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </Tooltip>
                </div>
              )
            )}
          </div>
        ) : null}

        {!showAddForm && (
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="size-3.5 mr-1" />
            {tSettings("jobRoles.addRole")}
          </Button>
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{tSettings("deleteRoleTitle")}</DialogTitle>
            <DialogDescription>
              {tSettings.rich("deleteRoleDesc", {
                name: deleteTarget?.name ?? "",
                strong: (chunks) => (
                  <span className="font-medium text-gray-900 dark:text-gray-50">{chunks}</span>
                ),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {tCommon("cancel")}
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                const target = deleteTarget
                setDeleteTarget(null)
                if (target) handleDeleteRole(target)
              }}
            >
              {tSettings("deleteRoleConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  )
}
