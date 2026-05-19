const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

export function isValidDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false
  const d = new Date(s + "T00:00:00Z")
  return !isNaN(d.getTime())
}

export function isValidTime(s: unknown): s is string {
  if (typeof s !== "string" || !TIME_RE.test(s)) return false
  const [h, m] = s.split(":").map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

export function isPositiveFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && isFinite(n) && n >= 0
}

export function isNonNegativeInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0
}

// Returns true if startTime < endTime (next-day shifts allowed via dates, so
// we don't block end < start — that's a feature for overnight shifts — but we
// do require they differ).
export function timesAreDifferent(start: string, end: string): boolean {
  return start !== end
}

export type PaginationParams = { limit: number; offset: number }
export type Paginated<T> = { data: T[]; meta: { total: number; limit: number; offset: number } }

export function parsePaginationParams(
  url: URL,
  defaults: { limit: number; maxLimit: number },
): PaginationParams {
  const rawLimit  = parseInt(url.searchParams.get("limit")  ?? "", 10)
  const rawOffset = parseInt(url.searchParams.get("offset") ?? "", 10)
  const limit  = isNaN(rawLimit)  ? defaults.limit  : Math.min(Math.max(1, rawLimit),  defaults.maxLimit)
  const offset = isNaN(rawOffset) ? 0               : Math.max(0, rawOffset)
  return { limit, offset }
}
