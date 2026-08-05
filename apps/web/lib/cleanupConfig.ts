// Client-safe: no Prisma imports. Shared between lib/cleanup.ts and the settings page.

// Cutoffs only. The labels that used to live here were rendered straight into
// the settings UI, so they stayed English on a Danish page; the copy now lives
// in the manager catalogue (settings.dataRetention.item*) with the number
// interpolated from here, keeping one source for the actual retention period.
export const RETENTION = {
  schedules:    { months: 12 },
  availability: { months:  6 },
  events:       { months:  3 },
} as const

export type CleanupPreview = {
  schedules: number
  availability: number
  events: number
  total: number
}

export type CleanupResult = CleanupPreview & {
  sessions?: number
  /** Expired "try the live demo" sandboxes removed this run. */
  demoOrgs?: number
  demoUsers?: number
}
