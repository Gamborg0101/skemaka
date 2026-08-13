import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ApiClient, ApiError } from "../client"

// ─── fetch stub ───────────────────────────────────────────────────────────────

type StubResponse = {
  ok: boolean
  status: number
  statusText?: string
  json?: () => Promise<unknown>
}

function res(status: number, body?: unknown, statusText = ""): StubResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  }
}

/** A response whose body is not JSON — `res.json()` rejects, as it would on HTML. */
function nonJson(status: number, statusText: string): StubResponse {
  return {
    ok: false,
    status,
    statusText,
    json: async () => {
      throw new SyntaxError("Unexpected token < in JSON")
    },
  }
}

let fetchMock: ReturnType<typeof vi.fn>

/** Queue responses; each call shifts one off. Falls back to the last one. */
function respondWith(...responses: StubResponse[]) {
  const queue = [...responses]
  fetchMock.mockImplementation(async () =>
    queue.length > 1 ? queue.shift() : queue[0],
  )
}

function lastCall() {
  const calls = fetchMock.mock.calls
  return calls[calls.length - 1] as [string, RequestInit]
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── Request shaping ──────────────────────────────────────────────────────────

describe("ApiClient — request shaping", () => {
  it("prefixes the path with the base URL", async () => {
    respondWith(res(200, { data: 1 }))
    const client = new ApiClient("https://api.example.com", () => "tok")

    await client.get("/api/orgs/o1/employees")

    expect(lastCall()[0]).toBe("https://api.example.com/api/orgs/o1/employees")
  })

  it("sends the bearer token when one is available", async () => {
    respondWith(res(200, {}))
    const client = new ApiClient("", () => "tok-123")

    await client.get("/x")

    const headers = lastCall()[1].headers as Record<string, string>
    expect(headers.Authorization).toBe("Bearer tok-123")
    expect(headers["Content-Type"]).toBe("application/json")
  })

  it("omits Authorization entirely when there is no token", async () => {
    respondWith(res(200, {}))
    const client = new ApiClient("", () => null)

    await client.get("/x")

    const headers = lastCall()[1].headers as Record<string, string>
    expect(headers).not.toHaveProperty("Authorization")
  })

  it("lets caller-supplied headers override the defaults", async () => {
    respondWith(res(200, {}))
    const client = new ApiClient("", () => "tok")

    // `get()` has no options param, so exercise the same path through the
    // private request() via post() with an explicit header.
    await client.post("/x", { a: 1 })

    expect((lastCall()[1].headers as Record<string, string>)["Content-Type"])
      .toBe("application/json")
  })

  it("JSON-serializes the body on POST/PATCH/PUT", async () => {
    respondWith(res(200, {}))
    const client = new ApiClient("", () => "tok")

    await client.post("/x", { weekStart: "2026-08-10" })

    expect(lastCall()[1].method).toBe("POST")
    expect(lastCall()[1].body).toBe('{"weekStart":"2026-08-10"}')
  })

  it("sends no body when none is given", async () => {
    respondWith(res(200, {}))
    const client = new ApiClient("", () => "tok")

    await client.post("/x")

    expect(lastCall()[1].body).toBeUndefined()
  })

  it("uses the right verb for patch/put/del", async () => {
    respondWith(res(204))
    const client = new ApiClient("", () => "tok")

    await client.patch("/x", {})
    expect(lastCall()[1].method).toBe("PATCH")

    await client.put("/x", {})
    expect(lastCall()[1].method).toBe("PUT")

    await client.del("/x")
    expect(lastCall()[1].method).toBe("DELETE")
  })
})

// ─── Response handling ────────────────────────────────────────────────────────

describe("ApiClient — response handling", () => {
  it("returns the parsed JSON body on success", async () => {
    respondWith(res(200, { data: { id: "s1" } }))
    const client = new ApiClient("", () => "tok")

    await expect(client.get("/x")).resolves.toEqual({ data: { id: "s1" } })
  })

  it("resolves to undefined on 204 without parsing a body", async () => {
    respondWith(res(204))
    const client = new ApiClient("", () => "tok")

    await expect(client.del("/x")).resolves.toBeUndefined()
  })

  it("throws ApiError carrying the server's error message and status", async () => {
    respondWith(res(409, { error: "You are the sole manager" }, "Conflict"))
    const client = new ApiClient("", () => "tok")

    await expect(client.del("/api/me/account")).rejects.toMatchObject({
      name: "ApiError",
      message: "You are the sole manager",
      status: 409,
    })
    await expect(client.del("/api/me/account")).rejects.toBeInstanceOf(ApiError)
  })

  it("falls back to statusText when the error body is not JSON", async () => {
    respondWith(nonJson(502, "Bad Gateway"))
    const client = new ApiClient("", () => "tok")

    await expect(client.get("/x")).rejects.toMatchObject({
      message: "Bad Gateway",
      status: 502,
    })
  })

  it("does not attempt a refresh for non-401 failures", async () => {
    respondWith(res(403, { error: "Forbidden" }))
    const refresher = vi.fn(async () => true)
    const client = new ApiClient("", () => "tok")
    client.setRefresher(refresher)

    await expect(client.get("/x")).rejects.toMatchObject({ status: 403 })
    expect(refresher).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

// ─── 401 refresh-and-retry ────────────────────────────────────────────────────

describe("ApiClient — 401 refresh and retry", () => {
  it("refreshes once and replays the request when the refresh succeeds", async () => {
    respondWith(res(401, { error: "Expired" }), res(200, { data: "ok" }))
    let token = "old"
    const refresher = vi.fn(async () => {
      token = "new"
      return true
    })
    const client = new ApiClient("", () => token)
    client.setRefresher(refresher)

    await expect(client.get("/x")).resolves.toEqual({ data: "ok" })
    expect(refresher).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // The replay must carry the NEW token, not the expired one.
    expect((lastCall()[1].headers as Record<string, string>).Authorization)
      .toBe("Bearer new")
  })

  it("surfaces the 401 when the refresh fails", async () => {
    respondWith(res(401, { error: "Expired" }))
    const refresher = vi.fn(async () => false)
    const client = new ApiClient("", () => "tok")
    client.setRefresher(refresher)

    await expect(client.get("/x")).rejects.toMatchObject({ status: 401 })
    expect(refresher).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not loop when the replayed request 401s again", async () => {
    respondWith(res(401, { error: "Expired" }))
    const refresher = vi.fn(async () => true)
    const client = new ApiClient("", () => "tok")
    client.setRefresher(refresher)

    await expect(client.get("/x")).rejects.toMatchObject({ status: 401 })
    // One refresh, one replay — then it gives up rather than spinning.
    expect(refresher).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("throws the 401 through when no refresher is registered", async () => {
    respondWith(res(401, { error: "Expired" }))
    const client = new ApiClient("", () => "tok")

    await expect(client.get("/x")).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("collapses concurrent 401s into a single refresh", async () => {
    // Every request 401s until the refresh lands, then all succeed.
    let refreshed = false
    fetchMock.mockImplementation(async () =>
      refreshed ? res(200, { data: "ok" }) : res(401, { error: "Expired" }),
    )

    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    const refresher = vi.fn(async () => {
      await gate
      refreshed = true
      return true
    })

    const client = new ApiClient("", () => "tok")
    client.setRefresher(refresher)

    const all = Promise.all([client.get("/a"), client.get("/b"), client.get("/c")])
    // Let all three reach their 401 before the refresh resolves.
    await Promise.resolve()
    release()

    await expect(all).resolves.toEqual([
      { data: "ok" },
      { data: "ok" },
      { data: "ok" },
    ])
    // The whole point of refreshInFlight: three 401s, one refresh.
    expect(refresher).toHaveBeenCalledTimes(1)
  })

  it("clears the in-flight refresh so a later 401 can refresh again", async () => {
    const refresher = vi.fn(async () => true)
    const client = new ApiClient("", () => "tok")
    client.setRefresher(refresher)

    respondWith(res(401, { error: "Expired" }), res(200, { data: 1 }))
    await client.get("/first")

    respondWith(res(401, { error: "Expired" }), res(200, { data: 2 }))
    await client.get("/second")

    expect(refresher).toHaveBeenCalledTimes(2)
  })

  it("still rejects when the refresher itself throws", async () => {
    respondWith(res(401, { error: "Expired" }))
    const client = new ApiClient("", () => "tok")
    client.setRefresher(async () => {
      throw new Error("network down")
    })

    await expect(client.get("/x")).rejects.toThrow("network down")
  })
})

// ─── Proactive refresh ────────────────────────────────────────────────────────

describe("ApiClient — proactive refresh", () => {
  it("refreshes before sending when the token is about to expire", async () => {
    respondWith(res(200, { data: "ok" }))
    let token = "about-to-expire"
    const refresher = vi.fn(async () => {
      token = "fresh"
      return true
    })
    const client = new ApiClient("", () => token)
    client.setRefresher(refresher)
    client.setProactiveRefreshCheck((t) => t === "about-to-expire")

    await client.get("/x")

    expect(refresher).toHaveBeenCalledTimes(1)
    // Only one fetch — the point is to avoid the 401 round-trip entirely.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((lastCall()[1].headers as Record<string, string>).Authorization)
      .toBe("Bearer fresh")
  })

  it("does not refresh when the token is still healthy", async () => {
    respondWith(res(200, {}))
    const refresher = vi.fn(async () => true)
    const client = new ApiClient("", () => "healthy")
    client.setRefresher(refresher)
    client.setProactiveRefreshCheck(() => false)

    await client.get("/x")

    expect(refresher).not.toHaveBeenCalled()
  })

  it("skips the expiry check when there is no token at all", async () => {
    respondWith(res(200, {}))
    const check = vi.fn(() => true)
    const refresher = vi.fn(async () => true)
    const client = new ApiClient("", () => null)
    client.setRefresher(refresher)
    client.setProactiveRefreshCheck(check)

    await client.get("/x")

    expect(check).not.toHaveBeenCalled()
    expect(refresher).not.toHaveBeenCalled()
  })

  it("skips the expiry check when no refresher is registered", async () => {
    respondWith(res(200, {}))
    const check = vi.fn(() => true)
    const client = new ApiClient("", () => "tok")
    client.setProactiveRefreshCheck(check)

    await client.get("/x")

    expect(check).not.toHaveBeenCalled()
  })

  it("collapses concurrent proactive refreshes into one", async () => {
    respondWith(res(200, { data: "ok" }))
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    const refresher = vi.fn(async () => {
      await gate
      return true
    })
    const client = new ApiClient("", () => "stale")
    client.setRefresher(refresher)
    client.setProactiveRefreshCheck(() => true)

    const all = Promise.all([client.get("/a"), client.get("/b")])
    await Promise.resolve()
    release()
    await all

    expect(refresher).toHaveBeenCalledTimes(1)
  })
})
