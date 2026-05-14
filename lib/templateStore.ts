// Module-level shift template store shared across manager pages.
// SAFE: only imported by "use client" files — never runs during SSR.
// TODO: replace with /api/organizations/[orgId]/shift-templates calls.

import type { ShiftTemplate } from "@/types"

const DEFAULTS: ShiftTemplate[] = [
  { id: "tmpl-1", organizationId: "org-1", name: "Morning",      startTime: "08:00", endTime: "16:00", breakMinutes: 30, jobRole: "",        colorTag: null },
  { id: "tmpl-2", organizationId: "org-1", name: "Afternoon",    startTime: "12:00", endTime: "20:00", breakMinutes: 30, jobRole: "",        colorTag: null },
  { id: "tmpl-3", organizationId: "org-1", name: "Evening",      startTime: "16:00", endTime: "22:00", breakMinutes: 0,  jobRole: "",        colorTag: null },
  { id: "tmpl-4", organizationId: "org-1", name: "Kitchen Prep", startTime: "07:00", endTime: "14:00", breakMinutes: 0,  jobRole: "Kitchen", colorTag: "orange" },
]

let _templates: ShiftTemplate[] = [...DEFAULTS]

export function getTemplates(): ShiftTemplate[] {
  return _templates
}

export function addTemplate(data: Omit<ShiftTemplate, "id">): ShiftTemplate {
  const tmpl: ShiftTemplate = { ...data, id: crypto.randomUUID() }
  _templates = [..._templates, tmpl]
  return tmpl
}

export function updateTemplate(id: string, patch: Partial<Omit<ShiftTemplate, "id" | "organizationId">>): void {
  _templates = _templates.map((t) => (t.id === id ? { ...t, ...patch } : t))
}

export function removeTemplate(id: string): void {
  _templates = _templates.filter((t) => t.id !== id)
}
