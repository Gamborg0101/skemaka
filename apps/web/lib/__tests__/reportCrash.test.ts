/**
 * Client crash reporting.
 *
 * The error boundaries promise the user that the team has been told. These tests
 * pin the two things that promise depends on: the report is actually sent, and a
 * boundary re-rendering in a loop cannot turn one crash into a mailbox full of
 * identical alerts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const ORIGINAL_URL = "http://localhost:3000/schedule?week=2026-08-10"

async function freshModule() {
  // The dedupe set is module state, so each test needs its own instance.
  vi.resetModules()
  return (await import("@/lib/reportCrash")).reportCrash
}

beforeEach(() => {
  vi.stubGlobal("window", { location: { href: ORIGINAL_URL } })
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("reportCrash", () => {
  it("POSTs the crash to /api/bug-report", async () => {
    const reportCrash = await freshModule()
    reportCrash(Object.assign(new Error("boom"), { digest: "d1" }), "app/error")

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/bug-report")
    expect(init.method).toBe("POST")
    // keepalive, or the browser cancels the request as the broken page unloads.
    expect(init.keepalive).toBe(true)

    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({
      errorMessage: "boom",
      url: ORIGINAL_URL,
      component: "app/error",
    })
    expect(typeof body.errorStack).toBe("string")
  })

  it("sends one report per distinct crash, not one per render", async () => {
    const reportCrash = await freshModule()
    const err = Object.assign(new Error("render loop"), { digest: "same" })

    reportCrash(err, "ErrorBoundary")
    reportCrash(err, "ErrorBoundary")
    reportCrash(err, "ErrorBoundary")

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("still reports a different crash on the same page", async () => {
    const reportCrash = await freshModule()
    reportCrash(Object.assign(new Error("first"), { digest: "a" }), "app/error")
    reportCrash(Object.assign(new Error("second"), { digest: "b" }), "app/error")

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("dedupes on the message when there is no digest", async () => {
    const reportCrash = await freshModule()
    reportCrash(new Error("no digest"), "app/error")
    reportCrash(new Error("no digest"), "app/error")

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("never throws when the network is gone", async () => {
    const reportCrash = await freshModule()
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))

    expect(() => reportCrash(new Error("boom"), "app/error")).not.toThrow()
  })

  it("does nothing on the server, where there is no page to report", async () => {
    const reportCrash = await freshModule()
    vi.stubGlobal("window", undefined)

    reportCrash(new Error("boom"), "app/error")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("falls back to a message when the error has none", async () => {
    const reportCrash = await freshModule()
    reportCrash(new Error(""), "app/error")

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string).errorMessage).toBe("Unknown client error")
  })
})
