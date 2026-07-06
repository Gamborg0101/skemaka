"use client"

import { useState } from "react"
import { Tag, Pencil, Trash2, Plus, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { useOrg } from "@/lib/orgContext"
import { useOptimisticList } from "@/lib/useOptimisticList"
import type { JobRole } from "@/types"
import { SettingsSection } from "./SettingsSection"

const PRESET_COLORS = [
  "#6366f1", // indigo
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#64748b", // slate
  "#f97316", // orange
]

function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="size-6 rounded-full border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          style={{
            backgroundColor: color,
            borderColor: value === color ? "white" : "transparent",
            boxShadow: value === color ? `0 0 0 2px ${color}` : "none",
          }}
          aria-label={`Select color ${color}`}
        />
      ))}
    </div>
  )
}

export function JobRolesSection() {
  const { orgId, jobRoles, setJobRoles } = useOrg()
  const { patch, remove, addOptimistic } = useOptimisticList(jobRoles, setJobRoles)

  // Add form
  const [showAddForm, setShowAddForm] = useState(false)
  const [addName, setAddName] = useState("")
  const [addColor, setAddColor] = useState(PRESET_COLORS[0])
  const [addSaving, setAddSaving] = useState(false)

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  function resetAddForm() {
    setAddName("")
    setAddColor(PRESET_COLORS[0])
    setShowAddForm(false)
  }

  function startEdit(role: JobRole) {
    setEditingId(role.id)
    setEditName(role.name)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName("")
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
        if (!r.ok) throw new Error(data.error ?? "Failed to save")
        toast.success(`"${data.data!.name}" role added`)
        resetAddForm()
        return data.data!
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add role")
    } finally {
      setAddSaving(false)
    }
  }

  async function handleSaveEdit(role: JobRole) {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === role.name) { cancelEdit(); return }
    setEditSaving(true)
    try {
      await patch(role.id, { name: trimmed }, async () => {
        const r = await fetch(`/api/orgs/${orgId}/roles/${role.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        })
        const data = await r.json() as { data?: JobRole; error?: string }
        if (!r.ok) throw new Error(data.error ?? "Failed to rename")
        toast.success(`Role renamed to "${trimmed}"`)
        cancelEdit()
        return data.data ?? null
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename role")
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteRole(role: JobRole) {
    await remove(role.id, async () => {
      const r = await fetch(`/api/orgs/${orgId}/roles/${role.id}`, { method: "DELETE" })
      const data = await r.json() as { error?: string }
      if (!r.ok) {
        toast.error(data.error ?? "Failed to delete role")
        throw new Error()
      }
      toast.success(`"${role.name}" deleted`)
    })
  }

  return (
    <SettingsSection
      icon={Tag}
      title="Job Roles"
      description="Roles assigned to employees and shifts. Renaming a role updates it everywhere."
    >
      <div className="mt-4">
        {showAddForm ? (
          <form
            onSubmit={handleAddRole}
            className="mb-3 p-4 rounded-lg border border-blue-100 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-950/30 space-y-3"
          >
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">New job role</p>
            <div className="space-y-1.5">
              <Label htmlFor="role-name" className="text-xs">Name</Label>
              <Input
                id="role-name"
                placeholder="e.g. Kitchen, Server, Bartender"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="h-8 text-sm"
                autoFocus
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Colour</Label>
              <ColorPicker value={addColor} onChange={setAddColor} />
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
                {addSaving ? "Saving…" : "Save role"}
              </Button>
            </div>
          </form>
        ) : null}

        {jobRoles.length === 0 && !showAddForm ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No job roles yet. Add one to organise your schedule.
          </p>
        ) : jobRoles.length > 0 ? (
          <div className="space-y-1 mb-3">
            {jobRoles.map((role) =>
              editingId === role.id ? (
                <div
                  key={role.id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700/40"
                >
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: role.color }}
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
                  <Tooltip content="Save">
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
                  <Tooltip content="Cancel">
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
              ) : (
                <div
                  key={role.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/40"
                >
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: role.color }}
                  />
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100 min-w-0 truncate">
                    {role.name}
                  </span>
                  <Tooltip content="Rename role">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEdit(role)}
                      className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:text-gray-500 dark:hover:text-blue-400 dark:hover:bg-blue-950/40 shrink-0"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Delete role">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteRole(role)}
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
            Add role
          </Button>
        )}
      </div>
    </SettingsSection>
  )
}
