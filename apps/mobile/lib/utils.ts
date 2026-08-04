import { getTimeFormat, type TimeFormat } from "./timeFormat"
import { getLocaleTag } from "@/lib/localeTag"

/**
 * Format a wall-clock "HH:MM" string per the org's clock setting.
 *   • "24h" (default, EU/Denmark): "09:00" / "14:30" — no AM/PM.
 *   • "12h" (US):                  "9:00 AM" / "2:30 PM".
 * Defaults to the org-wide setting (lib/timeFormat singleton); pass an explicit
 * format to override.
 */
export function formatTime(t: string, format: TimeFormat = getTimeFormat()): string {
  const [h, m] = t.split(":").map(Number)
  if (format === "24h") {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }
  const period = h >= 12 ? "PM" : "AM"
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, "0")} ${period}`
}

/** "2025-05-18" → "Mon 18 May" */
export function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z")
  return d.toLocaleDateString(getLocaleTag(), {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}

/** "2025-05-18" → "Monday, 18 May" */
export function formatDateLong(iso: string): string {
  const d = new Date(iso + "T00:00:00Z")
  return d.toLocaleDateString(getLocaleTag(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })
}

/** "2025-05-18" → "Mon" */
export function formatWeekday(iso: string): string {
  const d = new Date(iso + "T00:00:00Z")
  return d.toLocaleDateString(getLocaleTag(), { weekday: "short", timeZone: "UTC" })
}

/** Compute shift duration label: "7h 30m". Handles overnight shifts (e.g. 22:00–06:00). */
export function shiftDuration(startTime: string, endTime: string, breakMinutes = 0): string {
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  const raw = (eh * 60 + em) - (sh * 60 + sm) - breakMinutes
  // Add 24h for overnight shifts (raw is negative when end < start)
  const total = raw < 0 ? raw + 24 * 60 : raw
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** ISO timestamp → elapsed human label: "2h 37m" */
export function elapsedSince(isoTimestamp: string): string {
  const start = new Date(isoTimestamp).getTime()
  const diff = Math.max(0, Math.floor((Date.now() - start) / 60000))
  const h = Math.floor(diff / 60)
  const m = diff % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** ISO timestamp → "9:03 AM" (12h) or "09:03" (24h), per the org's clock setting. */
export function formatTimestamp(iso: string, format: TimeFormat = getTimeFormat()): string {
  return new Date(iso).toLocaleTimeString(getLocaleTag(), {
    hour: format === "24h" ? "2-digit" : "numeric",
    minute: "2-digit",
    hour12: format === "12h",
  })
}

/** Today's date as YYYY-MM-DD in UTC */
export function todayISO(): string {
  return new Date().toISOString().split("T")[0]
}

/** "2025-05-18" → is today? */
export function isToday(iso: string): boolean {
  return iso === todayISO()
}

/** Returns true when the shift's end time has already passed. */
export function isShiftDone(date: string, endTime: string): boolean {
  const [h, m] = endTime.split(":").map(Number)
  const end = new Date(`${date}T00:00:00`)
  end.setHours(h, m, 0, 0)
  return end < new Date()
}
