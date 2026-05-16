"use client"

import { useState, useEffect } from "react"
import { Building2, CalendarDays, Clock, Globe, LayoutGrid, AlignLeft, Users, Trash2, BookOpen, Plus, ShieldCheck, X, ChevronDown, Archive } from "lucide-react"
import { TimePicker } from "@/components/manager/TimePicker"
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
import { cn } from "@/lib/utils"
import { getOrgSettings, updateOrgSettings, SUPPORTED_CURRENCIES } from "@/lib/orgSettings"
import type { DayHours } from "@/lib/orgSettings"
import { formatTime } from "@/lib/dateUtils"
import { toast } from "sonner"
import { useOrg } from "@/lib/orgContext"
import type { ShiftTemplate } from "@/types"
import { RETENTION } from "@/lib/cleanupConfig"
import type { CleanupPreview } from "@/lib/cleanupConfig"

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const COMING_SOON = [
  {
    icon: Building2,
    title: "Organization",
    description: "Name, logo, and contact details for your business.",
  },
  {
    icon: Users,
    title: "Roles & Permissions",
    description: "Define job roles and what managers can do.",
  },
  {
    icon: Globe,
    title: "Locale & Time Zone",
    description: "Set the time zone and week start day for your schedules.",
  },
]

const BREAK_OPTIONS = [
  { label: "No break", value: "0" },
  { label: "15 min", value: "15" },
  { label: "30 min", value: "30" },
  { label: "45 min", value: "45" },
  { label: "60 min", value: "60" },
]

function formatTemplateSummary(t: ShiftTemplate) {
  const times = `${formatTime(t.startTime)}–${formatTime(t.endTime)}`
  const brk = t.breakMinutes > 0 ? ` · ${t.breakMinutes}m break` : ""
  const role = t.jobRole ? ` · ${t.jobRole}` : ""
  return `${times}${brk}${role}`
}

type TeamMember = {
  userId: string
  name: string | null
  email: string | null
  role: string
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="size-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <Icon className="size-4 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-gray-400 shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 border-t border-gray-100">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { orgId, jobRoles, shiftTemplates, setShiftTemplates } = useOrg()

  const [hours, setHours] = useState<DayHours[]>(() => getOrgSettings().hours)
  const [dirty, setDirty] = useState(false)
  const [defaultScheduleView, setDefaultScheduleView] = useState<"week" | "timeline">(
    () => getOrgSettings().defaultScheduleView
  )
  const [currency, setCurrency] = useState<string>(() => getOrgSettings().currency)
  const [convertingCurrency, setConvertingCurrency] = useState(false)

  // Team access
  const [team, setTeam] = useState<TeamMember[]>([])
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/team`)
      .then((r) => r.json())
      .then((d: { data?: TeamMember[] }) => { if (d.data) setTeam(d.data) })
      .catch(() => {})
  }, [orgId])

  // Add template form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [addName, setAddName] = useState("")
  const [addStart, setAddStart] = useState("09:00")
  const [addEnd, setAddEnd] = useState("17:00")
  const [addBreak, setAddBreak] = useState("30")
  const [addRole, setAddRole] = useState("")
  const [addSaving, setAddSaving] = useState(false)

  function updateDay(i: number, patch: Partial<DayHours>) {
    setHours((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], ...patch }
      return next
    })
    setDirty(true)
  }

  const [savingHours, setSavingHours] = useState(false)

  async function handleSaveHours() {
    setSavingHours(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }),
      })
      if (!r.ok) throw new Error("Failed to save")
      updateOrgSettings({ hours })
      setDirty(false)
      toast.success("Store hours saved")
    } catch {
      toast.error("Failed to save store hours")
    } finally {
      setSavingHours(false)
    }
  }

  function handleSetDefaultView(view: "week" | "timeline") {
    setDefaultScheduleView(view)
    updateOrgSettings({ defaultScheduleView: view })
    void fetch(`/api/orgs/${orgId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultScheduleView: view }),
    })
    toast.success(`Default schedule view set to ${view === "week" ? "Week" : "Timeline"}`)
  }

  async function handleSetCurrency(code: string) {
    if (code === currency || convertingCurrency) return
    const prevCurrency = currency
    const name = SUPPORTED_CURRENCIES.find((c) => c.code === code)?.name ?? code
    setCurrency(code)
    setConvertingCurrency(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: code }),
      })
      if (!r.ok) {
        const data = await r.json() as { error?: string }
        throw new Error(data.error ?? "Failed")
      }
      updateOrgSettings({ currency: code })
      toast.success(`Wages converted to ${name}`)
    } catch (err) {
      setCurrency(prevCurrency)
      toast.error(err instanceof Error ? err.message : "Currency conversion failed")
    } finally {
      setConvertingCurrency(false)
    }
  }

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
    setShiftTemplates((prev) => prev.filter((t) => t.id !== tmpl.id))
    try {
      const r = await fetch(`/api/orgs/${orgId}/shift-templates/${tmpl.id}`, { method: "DELETE" })
      if (!r.ok) {
        setShiftTemplates((prev) => {
          const restored = [...prev, tmpl].sort((a, b) => a.sortOrder - b.sortOrder)
          return restored
        })
        toast.error("Failed to delete shift type")
      } else {
        toast.success(`"${tmpl.name}" deleted`)
      }
    } catch {
      setShiftTemplates((prev) => {
        const restored = [...prev, tmpl].sort((a, b) => a.sortOrder - b.sortOrder)
        return restored
      })
      toast.error("Failed to delete shift type")
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const data = await r.json() as { data?: TeamMember; error?: string }
      if (!r.ok) throw new Error(data.error ?? "Failed to grant access")
      setTeam((prev) => [...prev, data.data!])
      setInviteEmail("")
      toast.success(`Manager access granted to ${data.data!.email}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to grant access")
    } finally {
      setInviting(false)
    }
  }

  // Data retention
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null)
  const [cleanupPreviewing, setCleanupPreviewing] = useState(false)
  const [cleanupRunning, setCleanupRunning] = useState(false)
  const [cleanupDone, setCleanupDone] = useState<CleanupPreview | null>(null)

  async function handleCleanupPreview() {
    setCleanupPreviewing(true)
    setCleanupDone(null)
    try {
      const r = await fetch(`/api/orgs/${orgId}/cleanup`)
      const data = await r.json() as { data?: CleanupPreview }
      setCleanupPreview(data.data ?? null)
    } catch {
      toast.error("Failed to load cleanup preview")
    } finally {
      setCleanupPreviewing(false)
    }
  }

  async function handleCleanupRun() {
    setCleanupRunning(true)
    try {
      const r = await fetch(`/api/orgs/${orgId}/cleanup`, { method: "DELETE" })
      const data = await r.json() as { data?: CleanupPreview }
      setCleanupDone(data.data ?? null)
      setCleanupPreview(null)
      toast.success("Cleanup complete")
    } catch {
      toast.error("Cleanup failed")
    } finally {
      setCleanupRunning(false)
    }
  }

  async function handleRevoke(member: TeamMember) {
    setTeam((prev) => prev.filter((m) => m.userId !== member.userId))
    try {
      const r = await fetch(`/api/orgs/${orgId}/team/${member.userId}`, { method: "DELETE" })
      if (!r.ok) {
        setTeam((prev) => [...prev, member])
        toast.error("Failed to revoke access")
      } else {
        toast.success(`Manager access removed for ${member.email}`)
      }
    } catch {
      setTeam((prev) => [...prev, member])
      toast.error("Failed to revoke access")
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Organization settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your workspace configuration.</p>
      </div>

      {/* Store Hours */}
      <SettingsSection icon={Clock} title="Store Hours" description="Opening and closing times per day.">
        <div className="space-y-1 mt-4">
          {DAY_NAMES.map((name, i) => {
            const day = hours[i]
            return (
              <div
                key={name}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2",
                  !day.isOpen && "opacity-60"
                )}
              >
                <span className="w-24 text-sm font-medium text-gray-700 shrink-0">{name}</span>
                {day.isOpen ? (
                  <div className="flex items-center gap-2 flex-1">
                    <TimePicker value={day.openTime} onChange={(v) => updateDay(i, { openTime: v })} />
                    <span className="text-gray-400 text-sm">–</span>
                    <TimePicker value={day.closeTime} onChange={(v) => updateDay(i, { closeTime: v })} />
                  </div>
                ) : (
                  <span className="flex-1 text-sm text-gray-400">Closed</span>
                )}
                <button
                  type="button"
                  onClick={() => updateDay(i, { isOpen: !day.isOpen })}
                  className={cn(
                    "ml-auto shrink-0 text-xs font-medium px-2.5 py-1 rounded-full transition-colors",
                    day.isOpen
                      ? "text-gray-500 hover:bg-gray-100"
                      : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                  )}
                >
                  {day.isOpen ? "Set closed" : "Set open"}
                </button>
              </div>
            )
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between gap-4">
          <p className="text-xs text-gray-400">
            The timeline shows each day&apos;s hours with a 2-hour buffer on each end.
          </p>
          <Button
            onClick={handleSaveHours}
            disabled={!dirty || savingHours}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 shrink-0"
            size="sm"
          >
            {savingHours ? "Saving…" : "Save"}
          </Button>
        </div>
      </SettingsSection>

      {/* Shift Types */}
      <SettingsSection icon={BookOpen} title="Shift Types" description="Presets you can apply with one click when adding a shift.">
        <div className="mt-4">
          {/* Add form */}
          {showAddForm ? (
            <form onSubmit={handleAddTemplate} className="mb-3 p-4 rounded-lg border border-blue-100 bg-blue-50/40 space-y-3">
              <p className="text-sm font-medium text-gray-700">New shift type</p>
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

          {/* Template list */}
          {shiftTemplates.length === 0 && !showAddForm ? (
            <p className="text-sm text-gray-400 text-center py-4">
              No shift types yet. Add one to speed up scheduling.
            </p>
          ) : shiftTemplates.length > 0 ? (
            <div className="space-y-1 mb-3">
              {shiftTemplates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{tmpl.name}</span>
                    <span className="text-sm text-gray-400 ml-2">{formatTemplateSummary(tmpl)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteTemplate(tmpl)}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                    title="Delete shift type"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {!showAddForm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="size-3.5 mr-1" />
              Add shift type
            </Button>
          )}
        </div>
      </SettingsSection>

      {/* Team Access */}
      <SettingsSection icon={ShieldCheck} title="Team Access" description="People who can manage schedules and employees.">
        <div className="mt-4 space-y-4">
          {/* Current managers */}
          {team.length > 0 && (
            <div className="space-y-1">
              {team.map((member) => (
                <div key={member.userId} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{member.name ?? member.email}</span>
                    {member.name && (
                      <span className="text-sm text-gray-400 ml-2">{member.email}</span>
                    )}
                  </div>
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full shrink-0",
                    member.role === "ADMIN"
                      ? "bg-purple-50 text-purple-700"
                      : "bg-blue-50 text-blue-700"
                  )}>
                    {member.role === "ADMIN" ? "Admin" : "Manager"}
                  </span>
                  {member.role !== "ADMIN" && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRevoke(member)}
                      className="text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                      title="Remove manager access"
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Grant access form */}
          <div>
            <form onSubmit={handleInvite} className="flex gap-2">
              <Input
                type="email"
                placeholder="colleague@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-8 text-sm flex-1"
              />
              <Button
                type="submit"
                size="sm"
                disabled={inviting || !inviteEmail.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              >
                <Plus className="size-3.5 mr-1" />
                {inviting ? "Adding…" : "Grant access"}
              </Button>
            </form>
            <p className="text-xs text-gray-400 mt-2">
              They must already have an account. Access lets them view and edit the schedule.
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* Schedule View */}
      <SettingsSection icon={CalendarDays} title="Schedule View" description="Default view when opening the schedule.">
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSetDefaultView("week")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
              defaultScheduleView === "week"
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
            )}
          >
            <LayoutGrid className="size-4" />
            Week
          </button>
          <button
            type="button"
            onClick={() => handleSetDefaultView("timeline")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
              defaultScheduleView === "timeline"
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
            )}
          >
            <AlignLeft className="size-4" />
            Timeline
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          You can still switch views on the schedule page at any time.
        </p>
      </SettingsSection>

      {/* Currency */}
      <SettingsSection icon={Globe} title="Currency" description="Currency shown on wages and labor costs.">
        <div className="mt-4 flex flex-wrap gap-2">
          {SUPPORTED_CURRENCIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => handleSetCurrency(c.code)}
              disabled={convertingCurrency}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                currency === c.code
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
              )}
            >
              {convertingCurrency && currency === c.code ? (
                <span className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <span className="font-mono text-xs opacity-70">{c.code}</span>
              )}
              {c.name}
            </button>
          ))}
        </div>
        {convertingCurrency && (
          <p className="mt-2 text-xs text-gray-500">Converting wages at today&apos;s exchange rate…</p>
        )}
      </SettingsSection>

      {/* Data Retention */}
      <SettingsSection icon={Archive} title="Data Retention" description="Remove old schedules and availability data to keep the database lean.">
        <div className="mt-4 space-y-4">
          {/* Policy */}
          <ul className="space-y-1.5">
            {Object.values(RETENTION).map((r) => (
              <li key={r.label} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="size-1.5 rounded-full bg-gray-300 shrink-0" />
                {r.label}
              </li>
            ))}
            <li className="flex items-center gap-2 text-sm text-gray-600">
              <span className="size-1.5 rounded-full bg-gray-300 shrink-0" />
              Expired sessions (cleaned automatically)
            </li>
          </ul>

          <p className="text-xs text-gray-400">
            Cleanup also runs automatically every Sunday at 03:00 UTC.
          </p>

          {/* Result after run */}
          {cleanupDone && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              {cleanupDone.total === 0 ? (
                "Nothing to clean — database is already tidy."
              ) : (
                <>
                  Deleted{" "}
                  {[
                    cleanupDone.schedules > 0 && `${cleanupDone.schedules} schedule${cleanupDone.schedules !== 1 ? "s" : ""}`,
                    cleanupDone.availability > 0 && `${cleanupDone.availability} availability request${cleanupDone.availability !== 1 ? "s" : ""}`,
                    cleanupDone.events > 0 && `${cleanupDone.events} event${cleanupDone.events !== 1 ? "s" : ""}`,
                  ].filter(Boolean).join(", ")}.
                </>
              )}
            </div>
          )}

          {/* Preview result */}
          {cleanupPreview && !cleanupDone && (
            <div className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              cleanupPreview.total === 0
                ? "bg-gray-50 border-gray-200 text-gray-500"
                : "bg-amber-50 border-amber-200 text-amber-900"
            )}>
              {cleanupPreview.total === 0 ? (
                "Nothing to clean — everything is within the retention window."
              ) : (
                <div className="space-y-1">
                  <p className="font-medium">Ready to delete:</p>
                  {cleanupPreview.schedules > 0 && (
                    <p>{cleanupPreview.schedules} schedule{cleanupPreview.schedules !== 1 ? "s" : ""} (+ all their shifts)</p>
                  )}
                  {cleanupPreview.availability > 0 && (
                    <p>{cleanupPreview.availability} availability request{cleanupPreview.availability !== 1 ? "s" : ""} (+ submissions)</p>
                  )}
                  {cleanupPreview.events > 0 && (
                    <p>{cleanupPreview.events} scheduling event{cleanupPreview.events !== 1 ? "s" : ""}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!cleanupPreview && !cleanupDone && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCleanupPreview}
                disabled={cleanupPreviewing}
              >
                {cleanupPreviewing ? "Checking…" : "Preview cleanup"}
              </Button>
            )}
            {cleanupPreview && cleanupPreview.total > 0 && !cleanupDone && (
              <>
                <Button
                  size="sm"
                  onClick={handleCleanupRun}
                  disabled={cleanupRunning}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {cleanupRunning ? "Running…" : `Delete ${cleanupPreview.total} records`}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCleanupPreview(null)}
                  disabled={cleanupRunning}
                >
                  Cancel
                </Button>
              </>
            )}
            {(cleanupPreview?.total === 0 || cleanupDone) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setCleanupPreview(null); setCleanupDone(null) }}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </SettingsSection>

      {/* Coming-soon sections */}
      <div className="space-y-3">
        {COMING_SOON.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4"
          >
            <div className="mt-0.5 size-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Icon className="size-4 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{title}</p>
              <p className="text-sm text-gray-500 mt-0.5">{description}</p>
            </div>
            <span className="ml-auto shrink-0 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full self-center">
              Coming soon
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
