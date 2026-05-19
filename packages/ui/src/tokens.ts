// Shared design tokens — keep in sync with apps/web globals.css and
// apps/mobile tailwind.config.js.

export const colors = {
  brand: "#0066FF",
  brandLight: "#E5EFFF",
  success: "#16A34A",
  warning: "#CA8A04",
  danger: "#DC2626",
  muted: "#6B7280",
} as const

export const STATUS_COLORS = {
  PENDING:  { bg: "bg-yellow-50",  text: "text-yellow-800",  dot: "bg-yellow-400" },
  APPROVED: { bg: "bg-green-50",   text: "text-green-800",   dot: "bg-green-400"  },
  DENIED:   { bg: "bg-red-50",     text: "text-red-800",     dot: "bg-red-400"    },
} as const

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME:          "Full-time",
  REDUCED_FULL_TIME:  "Reduced full-time",
  PART_TIME:          "Part-time",
}
