// Client-safe: no Prisma imports. Shared between lib/cleanup.ts and the settings page.

export const RETENTION = {
  schedules:    { months: 12, label: "Schedules & shifts older than 12 months" },
  availability: { months:  6, label: "Availability requests older than 6 months" },
  events:       { months:  3, label: "Scheduling events older than 3 months" },
} as const

export type CleanupPreview = {
  schedules: number
  availability: number
  events: number
  total: number
}

export type CleanupResult = CleanupPreview & {
  sessions?: number
}
