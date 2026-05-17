// ── Date utilities ────────────────────────────────────────────────────────────
// Convention for YYYY-MM-DD ↔ Date conversions:
//   • Parse:  always new Date(isoDate + "T12:00:00")  — local noon stays within
//             the same calendar day in any timezone from UTC-11 to UTC+11.
//   • Format: always use local getFullYear/getMonth/getDate — never toISOString()
//             (which gives the UTC date, not the local one).
// Exception: getISOWeek / getISOYear / getMondayOfISOWeek operate entirely in
// UTC arithmetic as required by the ISO 8601 week spec.

/** Returns the ISO date string ("YYYY-MM-DD") for the Monday of the given date's week. */
export function getMondayOfWeek(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Adds (or subtracts) days from an ISO date string. Noon-anchored to avoid DST shifts; returns local date components. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00")
  d.setDate(d.getDate() + days)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Returns the ISO week number (1–53) for the given ISO date string. */
export function getISOWeek(isoDate: string): number {
  const d = new Date(isoDate + "T12:00:00")
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  return Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/** Returns the ISO year (may differ from Gregorian year at year boundaries) for the given ISO date string. */
export function getISOYear(isoDate: string): number {
  const d = new Date(isoDate + "T12:00:00")
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7))
  return utc.getUTCFullYear()
}

/** Returns the ISO date string for the Monday of the given ISO week and year. */
export function getMondayOfISOWeek(week: number, year: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1)
  const result = new Date(startOfWeek1)
  result.setUTCDate(startOfWeek1.getUTCDate() + (week - 1) * 7)
  return result.toISOString().split("T")[0]
}

/** Returns an array of 7 ISO date strings for the week starting on weekStart. */
export function getWeekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

/** "12 May – 18 May" style label for a week. Noon-anchored to stay on the correct local date. */
export function formatWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + "T12:00:00")
  const end = new Date(weekStart + "T12:00:00")
  end.setDate(end.getDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  return `${fmt(start)} – ${fmt(end)}`
}

export function formatDayLabel(isoDate: string): string {
  return new Date(isoDate + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

/** Compact 12-hour time formatter: "8AM" / "8:30AM". */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour}${period}` : `${hour}:${m.toString().padStart(2, "0")}${period}`
}

/** Net shift duration in decimal hours, clamped to 0 if break exceeds duration. */
export function calcHours(startTime: string, endTime: string, breakMinutes: number): number {
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  const totalMinutes = (eh * 60 + em) - (sh * 60 + sm) - breakMinutes
  return Math.max(0, totalMinutes / 60)
}

/** Net shift duration as a formatted string: "7h" or "7h 30m". Empty string if zero or negative. */
export function calcNetHours(startTime: string, endTime: string, breakMinutes: number): string {
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  const net = (eh * 60 + em) - (sh * 60 + sm) - breakMinutes
  if (net <= 0) return ""
  const h = Math.floor(net / 60)
  const m = net % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
