import { getLocaleTag } from "@/lib/localeTag"
/** Monday of the current ISO week as YYYY-MM-DD (UTC) */
export function currentWeek(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff))
  return mon.toISOString().split("T")[0]
}

/** Next week's Monday */
export function nextWeek(): string {
  const [y, m, d] = currentWeek().split("-").map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 7))
  return next.toISOString().split("T")[0]
}

/** Previous week's Monday */
export function prevWeek(week: string): string {
  const [y, m, d] = week.split("-").map(Number)
  const prev = new Date(Date.UTC(y, m - 1, d - 7))
  return prev.toISOString().split("T")[0]
}

/** The 7 days in the given ISO week (Mon–Sun) as YYYY-MM-DD strings */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const [y, m, d] = weekStart.split("-").map(Number)
    const date = new Date(Date.UTC(y, m - 1, d + i))
    return date.toISOString().split("T")[0]
  })
}

/** "Mon 18 May – Sun 24 May" */
export function weekRangeLabel(weekStart: string): string {
  const days = weekDays(weekStart)
  const fmt = (iso: string) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString(getLocaleTag(), {
      weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
    })
  return `${fmt(days[0])} – ${fmt(days[6])}`
}

/** Offset a week by n weeks (positive = forward, negative = backward) */
export function offsetWeek(weekStart: string, n: number): string {
  const [y, m, d] = weekStart.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + n * 7))
  return date.toISOString().split("T")[0]
}

/** Is the given date in the past? */
export function isPast(iso: string): boolean {
  const today = new Date().toISOString().split("T")[0]
  return iso < today
}
