import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ApiClient } from "../client"
import {
  DEFAULT_ORG_HOURS,
  cancelCoverRequest,
  clockIn,
  clockOut,
  getActiveEntry,
  getAllTimeOff,
  getMyAvailabilitySubmission,
  getMyShifts,
  getOpenAvailabilityRequest,
  getOrCreateSchedule,
  getPendingCoverRequests,
  getSchedule,
  listEmployees,
  submitAvailability,
  updateTimeEntry,
} from "../api"

// ─── Harness ──────────────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>
let client: ApiClient

function ok(body: unknown) {
  return { ok: true, status: 200, statusText: "", json: async () => body }
}

/** Route responses by URL substring so tests read as request/response pairs. */
function routes(table: Array<[string, unknown]>) {
  fetchMock.mockImplementation(async (url: string) => {
    const hit = table.find(([fragment]) => url.includes(fragment))
    if (!hit) throw new Error(`unexpected request: ${url}`)
    return ok(hit[1])
  })
}

/** Every URL fetch() was called with, in order. */
function urls(): string[] {
  return fetchMock.mock.calls.map((c) => c[0] as string)
}

function page<T>(data: T[], total: number, limit = 200, offset = 0) {
  return { data, meta: { total, limit, offset } }
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  client = new ApiClient("https://api.test", () => "tok")
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── Pagination ───────────────────────────────────────────────────────────────

describe("getAllPages (via listEmployees)", () => {
  it("returns every page, not just the first", async () => {
    const first = Array.from({ length: 200 }, (_, i) => ({ id: `e${i}` }))
    const second = Array.from({ length: 50 }, (_, i) => ({ id: `e${200 + i}` }))
    fetchMock
      .mockResolvedValueOnce(ok(page(first, 250, 200, 0)))
      .mockResolvedValueOnce(ok(page(second, 250, 200, 200)))

    const employees = await listEmployees(client, "o1")

    expect(employees).toHaveLength(250)
    expect(employees[249]).toEqual({ id: "e249" })
    expect(urls()[0]).toContain("limit=200&offset=0")
    expect(urls()[1]).toContain("limit=200&offset=200")
  })

  it("stops after one request when the first page covers the total", async () => {
    fetchMock.mockResolvedValueOnce(ok(page([{ id: "e1" }], 1)))

    await listEmployees(client, "o1")

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("appends the paging params with & when the path already has a query", async () => {
    fetchMock.mockResolvedValueOnce(ok(page([], 0)))

    // /time-off?employeeId=... already carries a `?`.
    await getAllTimeOff(client, "o1")
    const listUrl = urls()[0]
    expect(listUrl).toContain("/time-off?limit=200")

    fetchMock.mockResolvedValueOnce(ok(page([], 0)))
    const { getMyTimeOff } = await import("../api")
    await getMyTimeOff(client, "o1", "emp1")
    expect(urls()[1]).toContain("employeeId=emp1&limit=200")
  })

  it("breaks out when a page comes back empty rather than looping forever", async () => {
    // A server that reports a bogus total but returns nothing must not spin.
    fetchMock.mockResolvedValue(ok(page([], 9999)))

    const employees = await listEmployees(client, "o1")

    expect(employees).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("tolerates a response with no data array", async () => {
    fetchMock.mockResolvedValueOnce(ok({ meta: { total: 0, limit: 200, offset: 0 } }))

    await expect(listEmployees(client, "o1")).resolves.toEqual([])
  })
})

// ─── Schedules & shifts ───────────────────────────────────────────────────────

describe("schedules", () => {
  it("queries with weekStart (not week) — the param the server actually reads", async () => {
    routes([["/schedules", { data: null }]])

    await getSchedule(client, "o1", "2026-08-10")

    // Passing `week` is silently ignored server-side and returns every
    // schedule for the org, which looks like a working response.
    expect(urls()[0]).toContain("schedules?weekStart=2026-08-10")
    expect(urls()[0]).not.toContain("schedules?week=")
  })

  it("returns null when the week has no schedule", async () => {
    routes([["/schedules", { data: null }]])

    await expect(getSchedule(client, "o1", "2026-08-10")).resolves.toBeNull()
  })

  it("getOrCreateSchedule returns the existing schedule without creating one", async () => {
    routes([["/schedules", { data: { id: "sch1", shifts: [] } }]])

    const schedule = await getOrCreateSchedule(client, "o1", "2026-08-10")

    expect(schedule).toMatchObject({ id: "sch1" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]?.method).toBeUndefined() // a GET
  })

  it("getOrCreateSchedule POSTs the weekStart when none exists", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ data: null }))
      .mockResolvedValueOnce(ok({ data: { id: "sch-new" } }))

    const schedule = await getOrCreateSchedule(client, "o1", "2026-08-10")

    expect(schedule).toMatchObject({ id: "sch-new" })
    expect(fetchMock.mock.calls[1][1].method).toBe("POST")
    expect(fetchMock.mock.calls[1][1].body).toBe('{"weekStart":"2026-08-10"}')
  })

  it("getMyShifts keeps only the caller's shifts", async () => {
    routes([
      [
        "/schedules",
        {
          data: {
            id: "sch1",
            shifts: [
              { id: "s1", employeeId: "emp1" },
              { id: "s2", employeeId: "emp2" },
              { id: "s3", employeeId: "emp1" },
            ],
          },
        },
      ],
    ])

    const shifts = await getMyShifts(client, "o1", "2026-08-10", "emp1")

    expect(shifts.map((s) => s.id)).toEqual(["s1", "s3"])
  })

  it("getMyShifts returns [] when the week has no schedule at all", async () => {
    routes([["/schedules", { data: null }]])

    await expect(getMyShifts(client, "o1", "2026-08-10", "emp1")).resolves.toEqual([])
  })
})

// ─── Time entries ─────────────────────────────────────────────────────────────

describe("time entries", () => {
  it("getActiveEntry returns null when not clocked in", async () => {
    routes([["/time-entries/active", { data: null }]])

    await expect(getActiveEntry(client, "o1")).resolves.toBeNull()
  })

  it("getActiveEntry omits the employeeId param when not given", async () => {
    routes([["/time-entries/active", { data: null }]])

    await getActiveEntry(client, "o1")

    expect(urls()[0]).toMatch(/time-entries\/active$/)
  })

  it("getActiveEntry URL-encodes an explicit employeeId", async () => {
    routes([["/time-entries/active", { data: null }]])

    await getActiveEntry(client, "o1", "emp/1")

    expect(urls()[0]).toContain("employeeId=emp%2F1")
  })

  it("clockIn unwraps the data envelope and forwards its options", async () => {
    routes([["/time-entries", { data: { id: "te1" } }]])

    const entry = await clockIn(client, "o1", { shiftId: "s1", note: "late" })

    expect(entry).toEqual({ id: "te1" })
    expect(fetchMock.mock.calls[0][1].body).toBe('{"shiftId":"s1","note":"late"}')
  })

  it("clockOut PATCHes the active entry", async () => {
    routes([["/time-entries/active", { data: { id: "te1" } }]])

    await clockOut(client, "o1", { breakMinutes: 30 })

    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH")
    expect(fetchMock.mock.calls[0][1].body).toBe('{"breakMinutes":30}')
  })

  it("updateTimeEntry URL-encodes the entry id", async () => {
    routes([["/time-entries/", { data: { id: "te 1" } }]])

    await updateTimeEntry(client, "o1", "te 1", { clockIn: "2026-08-13T09:00:00Z" })

    expect(urls()[0]).toContain("/time-entries/te%201")
  })
})

// ─── Availability ─────────────────────────────────────────────────────────────

describe("availability", () => {
  it("uses the ?week= param when asking for a specific week", async () => {
    routes([["/availability", { data: { id: "req1" }, orgHours: [] }]])

    const result = await getOpenAvailabilityRequest(client, "o1", "2026-08-10")

    // NOTE: availability takes `week`, while schedules take `weekStart`.
    expect(urls()[0]).toContain("availability?week=2026-08-10")
    expect(result.request).toMatchObject({ id: "req1" })
  })

  it("falls back to DEFAULT_ORG_HOURS when the server omits orgHours", async () => {
    routes([["/availability", { data: { id: "req1" } }]])

    const result = await getOpenAvailabilityRequest(client, "o1", "2026-08-10")

    expect(result.orgHours).toEqual(DEFAULT_ORG_HOURS)
    expect(result.orgHours).toHaveLength(7)
    // Sunday closed by default; Monday open 07:00–21:00.
    expect(result.orgHours[6].isOpen).toBe(false)
    expect(result.orgHours[0]).toMatchObject({ openTime: "07:00", closeTime: "21:00" })
  })

  it("asks for the newest OPEN request when no week is given", async () => {
    routes([["/availability", page([{ id: "req-open" }], 1)]])

    const result = await getOpenAvailabilityRequest(client, "o1")

    expect(urls()[0]).toContain("availability?status=OPEN&limit=1")
    expect(result.request).toMatchObject({ id: "req-open" })
  })

  it("returns a null request when no OPEN request exists", async () => {
    routes([["/availability", page([], 0)]])

    const result = await getOpenAvailabilityRequest(client, "o1")

    expect(result.request).toBeNull()
  })

  it("getMyAvailabilitySubmission returns null when nothing was submitted", async () => {
    routes([["/my-submission", { data: null }]])

    await expect(
      getMyAvailabilitySubmission(client, "o1", "req1"),
    ).resolves.toBeNull()
  })

  it("submitAvailability posts the days under a `days` key", async () => {
    routes([["/submit", {}]])

    await submitAvailability(client, "o1", "req1", [
      { date: "2026-08-10", isAvailable: true, startTime: "09:00", endTime: "17:00" },
    ])

    expect(fetchMock.mock.calls[0][1].method).toBe("POST")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      days: [
        { date: "2026-08-10", isAvailable: true, startTime: "09:00", endTime: "17:00" },
      ],
    })
  })
})

// ─── Time off ─────────────────────────────────────────────────────────────────

describe("getAllTimeOff sorting", () => {
  it("floats PENDING to the top, then sorts by start date descending", async () => {
    fetchMock.mockResolvedValueOnce(
      ok(
        page(
          [
            { id: "a", status: "APPROVED", startDate: "2026-09-01" },
            { id: "b", status: "PENDING", startDate: "2026-07-01" },
            { id: "c", status: "DENIED", startDate: "2026-08-01" },
            { id: "d", status: "PENDING", startDate: "2026-10-01" },
          ],
          4,
        ),
      ),
    )

    const items = await getAllTimeOff(client, "o1")

    // Both PENDING first (newest first), then the rest newest first.
    expect(items.map((i) => i.id)).toEqual(["d", "b", "a", "c"])
  })

  it("does not mutate the fetched array in place", async () => {
    const raw = [
      { id: "a", status: "APPROVED", startDate: "2026-09-01" },
      { id: "b", status: "PENDING", startDate: "2026-07-01" },
    ]
    fetchMock.mockResolvedValueOnce(ok(page(raw, 2)))

    await getAllTimeOff(client, "o1")

    expect(raw.map((r) => r.id)).toEqual(["a", "b"])
  })
})

// ─── Cover requests ───────────────────────────────────────────────────────────

describe("cover requests", () => {
  it("getPendingCoverRequests asks for the manager scope", async () => {
    routes([["/cover-requests", { data: [] }]])

    await getPendingCoverRequests(client, "o1")

    expect(urls()[0]).toContain("cover-requests?scope=manager")
  })

  it("cancelCoverRequest unwraps the envelope instead of returning it", async () => {
    // The DELETE route answers 200 `{ data }`, not 204 — see api.ts.
    routes([["/cover-requests/req1", { data: { id: "req1", status: "CANCELLED" } }]])

    const result = await cancelCoverRequest(client, "o1", "req1")

    expect(result).toEqual({ id: "req1", status: "CANCELLED" })
    // Regression guard: it used to hand back the `{ data: ... }` wrapper.
    expect(result).not.toHaveProperty("data")
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE")
  })
})
