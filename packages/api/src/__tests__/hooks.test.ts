// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createElement, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor, act } from "@testing-library/react"
import { ApiClient } from "../client"
import { ApiClientProvider, useApiClient } from "../context"
import { useSchedule, useCreateShift, useDeleteShift } from "../hooks/useSchedule"
import { useEmployees, useUpdateEmployee } from "../hooks/useEmployees"
import { useActiveEntry, useClockIn, useClockOut } from "../hooks/useClock"
import { useTimeOff, useCreateTimeOff, useReviewTimeOff } from "../hooks/useTimeOff"

// ─── Harness ──────────────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>
let qc: QueryClient
let client: ApiClient

function ok(body: unknown) {
  return { ok: true, status: 200, statusText: "", json: async () => body }
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: qc },
    createElement(ApiClientProvider, { client, children }),
  )
}

function urls(): string[] {
  return fetchMock.mock.calls.map((c) => c[0] as string)
}

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(ok({ data: [] }))
  vi.stubGlobal("fetch", fetchMock)
  client = new ApiClient("https://api.test", () => "tok")
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})

afterEach(() => {
  qc.clear()
  vi.unstubAllGlobals()
})

// ─── Context ──────────────────────────────────────────────────────────────────

describe("useApiClient", () => {
  it("throws a useful error when used outside the provider", () => {
    // React logs the error boundary trace; silence it for this expected throw.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => renderHook(() => useApiClient())).toThrow(
      /must be inside <ApiClientProvider>/,
    )
    spy.mockRestore()
  })

  it("hands back the client the provider was given", () => {
    const { result } = renderHook(() => useApiClient(), { wrapper })
    expect(result.current).toBe(client)
  })
})

// ─── Query keys and gating ────────────────────────────────────────────────────

describe("query keys", () => {
  it("scopes the schedule cache by org AND week", async () => {
    const { result } = renderHook(() => useSchedule("o1", "2026-08-10"), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // A shared key across weeks would show week A's shifts under week B.
    expect(qc.getQueryData(["schedule", "o1", "2026-08-10"])).toBeDefined()
    expect(qc.getQueryData(["schedule", "o1", "2026-08-17"])).toBeUndefined()
  })

  it("scopes the active-entry cache by org AND employee", async () => {
    fetchMock.mockResolvedValue(ok({ data: null }))
    const { result } = renderHook(() => useActiveEntry("o1", "emp1"), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(qc.getQueryData(["clock-active", "o1", "emp1"])).toBeNull()
    expect(qc.getQueryData(["clock-active", "o1", "emp2"])).toBeUndefined()
  })

  it("includes the filters in the time-off key so filtered views don't collide", async () => {
    const { result } = renderHook(
      () => useTimeOff("o1", { status: "PENDING" }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(qc.getQueryData(["time-off", "o1", { status: "PENDING" }])).toEqual([])
    expect(qc.getQueryData(["time-off", "o1", undefined])).toBeUndefined()
  })
})

describe("enabled gating", () => {
  it("does not fetch the schedule before the week is known", () => {
    renderHook(() => useSchedule("o1", ""), { wrapper })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not fetch the schedule before the org is known", () => {
    renderHook(() => useSchedule("", "2026-08-10"), { wrapper })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not fetch employees without an org", () => {
    renderHook(() => useEmployees(""), { wrapper })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not poll the clock before the employee is known", () => {
    renderHook(() => useActiveEntry("o1", ""), { wrapper })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ─── Request URLs and unwrapping ──────────────────────────────────────────────

describe("query functions", () => {
  it("useSchedule requests the week with weekStart and unwraps data", async () => {
    fetchMock.mockResolvedValue(ok({ data: { id: "sch1" } }))
    const { result } = renderHook(() => useSchedule("o1", "2026-08-10"), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ id: "sch1" })
    expect(urls()[0]).toContain("/schedules?weekStart=2026-08-10")
  })

  it("useSchedule yields null rather than undefined for an empty week", async () => {
    fetchMock.mockResolvedValue(ok({ data: null }))
    const { result } = renderHook(() => useSchedule("o1", "2026-08-10"), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it("useEmployees falls back to [] when the server sends no data key", async () => {
    fetchMock.mockResolvedValue(ok({}))
    const { result } = renderHook(() => useEmployees("o1"), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it("useTimeOff builds the query string only from the filters given", async () => {
    const { result } = renderHook(
      () => useTimeOff("o1", { employeeId: "emp1" }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(urls()[0]).toContain("/time-off?employeeId=emp1")
    expect(urls()[0]).not.toContain("status=")
  })

  it("useTimeOff sends no query string when unfiltered", async () => {
    const { result } = renderHook(() => useTimeOff("o1"), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(urls()[0]).toMatch(/\/time-off$/)
  })

  it("useActiveEntry surfaces an ApiError instead of swallowing it", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      json: async () => ({ error: "Not your entry" }),
    })
    const { result } = renderHook(() => useActiveEntry("o1", "emp1"), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ status: 403, message: "Not your entry" })
  })
})

// ─── Polling ──────────────────────────────────────────────────────────────────

describe("useActiveEntry polling", () => {
  type IntervalFn = (q: { state: { data: unknown } }) => number | false

  /** `refetchInterval` is an observer option, absent from the public QueryOptions type. */
  function pollFn(): IntervalFn | undefined {
    const query = qc.getQueryCache().find({ queryKey: ["clock-active", "o1", "emp1"] })
    return (query?.options as { refetchInterval?: IntervalFn } | undefined)
      ?.refetchInterval
  }

  it("does not poll while the employee is clocked out", async () => {
    fetchMock.mockResolvedValue(ok({ data: null }))
    const { result } = renderHook(() => useActiveEntry("o1", "emp1"), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const interval = pollFn()
    expect(typeof interval).toBe("function")
    expect(interval?.({ state: { data: null } })).toBe(false)
  })

  it("polls every 30s once there is an open entry", async () => {
    fetchMock.mockResolvedValue(ok({ data: { id: "te1" } }))
    const { result } = renderHook(() => useActiveEntry("o1", "emp1"), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(pollFn()?.({ state: { data: { id: "te1" } } })).toBe(30_000)
  })
})

// ─── Mutations and cache invalidation ─────────────────────────────────────────

describe("mutations invalidate the caches their writes affect", () => {
  it("useCreateShift POSTs to the schedule and invalidates the org's schedules", async () => {
    const invalidate = vi.spyOn(qc, "invalidateQueries")
    fetchMock.mockResolvedValue(ok({ data: { id: "sh1" } }))

    const { result } = renderHook(() => useCreateShift("o1", "sch1"), { wrapper })
    let created: unknown
    await act(async () => {
      created = await result.current.mutateAsync({ employeeId: "emp1" })
    })

    expect(urls()[0]).toContain("/schedules/sch1/shifts")
    expect(fetchMock.mock.calls[0][1].method).toBe("POST")
    // The mutation resolves to the unwrapped shift, not the { data } envelope.
    expect(created).toEqual({ id: "sh1" })
    // Key is org-wide (no week) so every cached week refreshes.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["schedule", "o1"] })
  })

  it("useDeleteShift DELETEs and invalidates the org's schedules", async () => {
    const invalidate = vi.spyOn(qc, "invalidateQueries")
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => undefined })

    const { result } = renderHook(() => useDeleteShift("o1", "sch1"), { wrapper })
    await act(async () => {
      await result.current.mutateAsync("sh1")
    })

    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE")
    expect(urls()[0]).toContain("/schedules/sch1/shifts/sh1")
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["schedule", "o1"] })
  })

  it("useUpdateEmployee strips the id from the body and invalidates the roster", async () => {
    const invalidate = vi.spyOn(qc, "invalidateQueries")
    fetchMock.mockResolvedValue(ok({ data: { id: "emp1", name: "New" } }))

    const { result } = renderHook(() => useUpdateEmployee("o1"), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: "emp1", name: "New" })
    })

    expect(urls()[0]).toContain("/employees/emp1")
    // The id belongs in the path, not the payload.
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ name: "New" })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["employees", "o1"] })
  })

  it("useClockIn invalidates that employee's clock and the org's entries", async () => {
    const invalidate = vi.spyOn(qc, "invalidateQueries")
    fetchMock.mockResolvedValue(ok({ data: { id: "te1" } }))

    const { result } = renderHook(() => useClockIn("o1"), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ employeeId: "emp1", shiftId: "sh1" })
    })

    // Scoped to the employee who clocked in — not the whole org's clocks.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["clock-active", "o1", "emp1"] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["time-entries", "o1"] })
  })

  it("useClockOut PATCHes the active entry and invalidates the same keys", async () => {
    const invalidate = vi.spyOn(qc, "invalidateQueries")
    fetchMock.mockResolvedValue(ok({ data: { id: "te1" } }))

    const { result } = renderHook(() => useClockOut("o1"), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ employeeId: "emp1", breakMinutes: 30 })
    })

    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH")
    expect(urls()[0]).toContain("/time-entries/active")
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["clock-active", "o1", "emp1"] })
  })

  it("useCreateTimeOff invalidates every filtered time-off view", async () => {
    const invalidate = vi.spyOn(qc, "invalidateQueries")
    fetchMock.mockResolvedValue(ok({ data: { id: "to1" } }))

    const { result } = renderHook(() => useCreateTimeOff("o1"), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({
        employeeId: "emp1",
        startDate: "2026-09-01",
        endDate: "2026-09-03",
      })
    })

    // Prefix key, so the PENDING/APPROVED/employee-filtered caches all refresh.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["time-off", "o1"] })
  })

  it("useReviewTimeOff sends the decision in the body, id in the path", async () => {
    fetchMock.mockResolvedValue(ok({ data: { id: "to1", status: "APPROVED" } }))

    const { result } = renderHook(() => useReviewTimeOff("o1"), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: "to1", status: "APPROVED", reviewNote: "ok" })
    })

    expect(urls()[0]).toContain("/time-off/to1")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      status: "APPROVED",
      reviewNote: "ok",
    })
  })

  it("a failed mutation surfaces the error and skips invalidation", async () => {
    const invalidate = vi.spyOn(qc, "invalidateQueries")
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      statusText: "Conflict",
      json: async () => ({ error: "Shift already covered" }),
    })

    const { result } = renderHook(() => useCreateShift("o1", "sch1"), { wrapper })
    await act(async () => {
      await expect(
        result.current.mutateAsync({ employeeId: "emp1" }),
      ).rejects.toMatchObject({ status: 409 })
    })

    expect(invalidate).not.toHaveBeenCalled()
  })
})
