/**
 * Client-side pagination helpers for the `{ data, meta: { total, limit, offset } }`
 * envelope returned by the list endpoints (see lib/validate.ts `Paginated<T>`).
 */

export type PaginatedResponse<T> = {
  data: T[]
  meta: { total: number; limit: number; offset: number }
}

function withParams(url: string, limit: number, offset: number): string {
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}limit=${limit}&offset=${offset}`
}

/**
 * Fetch a single page of a paginated list endpoint.
 * Throws on a non-OK response so callers surface load failures.
 */
export async function fetchPage<T>(
  url: string,
  limit: number,
  offset: number,
  init?: RequestInit,
): Promise<PaginatedResponse<T>> {
  const res = await fetch(withParams(url, limit, offset), init)
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`)
  return (await res.json()) as PaginatedResponse<T>
}

/**
 * Walk every page of a paginated list endpoint and return the full result set.
 *
 * Used by screens that genuinely need the whole collection (weekly grids,
 * dropdowns, the mobile client) — it consumes the paginated API correctly
 * instead of guessing a "big enough" limit, so nothing is ever silently
 * truncated regardless of dataset size.
 */
export async function fetchAllPages<T>(
  url: string,
  pageSize = 200,
  init?: RequestInit,
): Promise<T[]> {
  const all: T[] = []
  let offset = 0
  // Guard against a misbehaving endpoint that never advances.
  for (let safety = 0; safety < 10_000; safety++) {
    const { data, meta } = await fetchPage<T>(url, pageSize, offset, init)
    all.push(...data)
    offset += meta.limit
    if (all.length >= meta.total || data.length === 0) break
  }
  return all
}
