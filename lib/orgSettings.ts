// Module-level singleton — survives client-side navigation within the session.
// SAFE: only imported by "use client" pages; mutations happen post-hydration in
// the browser, never during SSR. If this module is ever imported from a Server
// Component it will silently share state across all concurrent requests — do not
// do that.
// TODO: replace with real API calls to /api/organizations/[orgId]/settings

export interface DayHours {
  isOpen: boolean
  openTime: string   // "HH:MM"
  closeTime: string  // "HH:MM"
}

export interface OrgSettings {
  hours: DayHours[]  // index 0 = Monday … 6 = Sunday
}

const DEFAULT_HOURS: DayHours[] = [
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" }, // Mon
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" }, // Tue
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" }, // Wed
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" }, // Thu
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" }, // Fri
  { isOpen: true,  openTime: "09:00", closeTime: "17:00" }, // Sat
  { isOpen: false, openTime: "09:00", closeTime: "17:00" }, // Sun
]

let _settings: OrgSettings = { hours: DEFAULT_HOURS.map((h) => ({ ...h })) }

export function getOrgSettings(): OrgSettings {
  return { hours: _settings.hours.map((h) => ({ ...h })) }
}

export function updateOrgSettings(patch: Partial<OrgSettings>): void {
  _settings = { ..._settings, ...patch }
}
