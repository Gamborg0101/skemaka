/** Format a 24h time string "09:00" → "9:00 AM" */
export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, "0")} ${period}`
}

/** "2025-05-18" → "Mon 18 May" */
export function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z")
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}

/** "2025-05-18" → "Monday, 18 May" */
export function formatDateLong(iso: string): string {
  const d = new Date(iso + "T00:00:00Z")
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })
}

/** "2025-05-18" → "Mon" */
export function formatWeekday(iso: string): string {
  const d = new Date(iso + "T00:00:00Z")
  return d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })
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

/** ISO timestamp → "9:03 AM" */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
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
