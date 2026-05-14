"use client"

import { useState, useReducer } from "react"
import { Building2, Clock, Globe, Users, Trash2, BookOpen } from "lucide-react"
import { TimePicker } from "@/components/manager/TimePicker"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getOrgSettings, updateOrgSettings } from "@/lib/orgSettings"
import type { DayHours } from "@/lib/orgSettings"
import { getTemplates, removeTemplate } from "@/lib/templateStore"
import { formatTime } from "@/lib/dateUtils"
import { toast } from "sonner"

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

export default function SettingsPage() {
  const [hours, setHours] = useState<DayHours[]>(() => getOrgSettings().hours)
  const [dirty, setDirty] = useState(false)
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  const templates = getTemplates()

  function handleDeleteTemplate(id: string, name: string) {
    removeTemplate(id)
    forceUpdate()
    toast.success(`Template "${name}" deleted`)
  }

  function updateDay(i: number, patch: Partial<DayHours>) {
    setHours((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], ...patch }
      return next
    })
    setDirty(true)
  }

  function handleSave() {
    updateOrgSettings({ hours })
    setDirty(false)
    toast.success("Store hours saved")
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Organization settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your workspace configuration.</p>
      </div>

      {/* Store Hours */}
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-5 mb-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="size-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <Clock className="size-4 text-gray-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Store Hours</p>
            <p className="text-sm text-gray-500">Opening and closing times per day.</p>
          </div>
        </div>

        <div className="space-y-1">
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
            onClick={handleSave}
            disabled={!dirty}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 shrink-0"
            size="sm"
          >
            Save
          </Button>
        </div>
      </div>

      {/* Shift Templates */}
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-5 mb-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="size-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <BookOpen className="size-4 text-gray-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Shift Templates</p>
            <p className="text-sm text-gray-500">Reusable shift configurations. Save new templates from the Add Shift dialog.</p>
          </div>
        </div>

        {templates.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No templates yet. Open Add Shift and click &quot;Save current as template&quot;.</p>
        ) : (
          <div className="space-y-1">
            {templates.map((tmpl) => (
              <div key={tmpl.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800">{tmpl.name}</span>
                  <span className="text-sm text-gray-400 ml-2">
                    {formatTime(tmpl.startTime)}–{formatTime(tmpl.endTime)}
                    {tmpl.breakMinutes > 0 && ` · ${tmpl.breakMinutes}m break`}
                  </span>
                  {tmpl.jobRole && (
                    <span className="text-sm text-gray-400 ml-2">· {tmpl.jobRole}</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDeleteTemplate(tmpl.id, tmpl.name)}
                  className="text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                  title="Delete template"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

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
