/**
 * Unit tests for the client pagination helpers — the guarantee that callers
 * needing the whole collection actually walk every page.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { fetchAllPages, fetchPage } from "@/lib/pagination"

afterEach(() => {
  vi.restoreAllMocks()
})

function mockPaged(total: number, pageSize: number) {
  // Returns a fetch stub that serves `total` sequentially-numbered items in pages.
  return vi.fn(async (url: string | URL) => {
    const u = new URL(String(url), "http://x")
    const limit = Number(u.searchParams.get("limit"))
    const offset = Number(u.searchParams.get("offset"))
    const data = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => ({
      id: offset + i,
    }))
    return {
      ok: true,
      json: async () => ({ data, meta: { total, limit: pageSize, offset } }),
    } as Response
  })
}

describe("fetchAllPages", () => {
  it("walks every page and returns the full set", async () => {
    global.fetch = mockPaged(45, 20) as unknown as typeof fetch
    const all = await fetchAllPages<{ id: number }>("/api/things", 20)
    expect(all).toHaveLength(45)
    expect(all[0].id).toBe(0)
    expect(all[44].id).toBe(44)
    expect(global.fetch).toHaveBeenCalledTimes(3) // 20 + 20 + 5
  })

  it("makes a single request when everything fits on one page", async () => {
    global.fetch = mockPaged(10, 200) as unknown as typeof fetch
    const all = await fetchAllPages<{ id: number }>("/api/things")
    expect(all).toHaveLength(10)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("appends limit/offset with & when the url already has a query", async () => {
    const stub = mockPaged(5, 200)
    global.fetch = stub as unknown as typeof fetch
    await fetchAllPages("/api/things?status=active")
    const calledUrl = String(stub.mock.calls[0][0])
    expect(calledUrl).toContain("?status=active&limit=")
  })

  it("returns empty for an empty collection", async () => {
    global.fetch = mockPaged(0, 200) as unknown as typeof fetch
    expect(await fetchAllPages("/api/things")).toEqual([])
  })
})

describe("fetchPage", () => {
  it("throws on a non-OK response", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 }) as Response) as unknown as typeof fetch
    await expect(fetchPage("/api/things", 10, 0)).rejects.toThrow(/500/)
  })
})
