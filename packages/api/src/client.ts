export type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown }

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// Returns true if the refresh succeeded and the request should be retried.
type Refresher = () => Promise<boolean>

// Optional hook: receives the current token and returns true when a proactive
// refresh should happen before sending the request (e.g. token expires in <30s).
type ProactiveRefreshCheck = (token: string) => boolean

export class ApiClient {
  private refresher: Refresher | null = null
  private proactiveRefreshCheck: ProactiveRefreshCheck | null = null
  // Shared in-flight promise so concurrent 401s only trigger one refresh.
  private refreshInFlight: Promise<boolean> | null = null

  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => string | null,
  ) {}

  /** Register a callback that is invoked on HTTP 401. Return true to retry. */
  setRefresher(fn: Refresher): void {
    this.refresher = fn
  }

  /**
   * Register a callback that inspects the current token before each request.
   * Return true to trigger a proactive refresh (token about to expire).
   */
  setProactiveRefreshCheck(fn: ProactiveRefreshCheck): void {
    this.proactiveRefreshCheck = fn
  }

  private async request<T>(
    path: string,
    init: RequestOptions = {},
    retry = true,
  ): Promise<T> {
    // Proactive token expiry check: refresh before the request if the token is
    // about to expire, avoiding a failed request + round-trip refresh cycle.
    const currentToken = this.getToken()
    if (currentToken && this.proactiveRefreshCheck && this.refresher) {
      if (this.proactiveRefreshCheck(currentToken)) {
        if (!this.refreshInFlight) {
          this.refreshInFlight = this.refresher().finally(() => {
            this.refreshInFlight = null
          })
        }
        await this.refreshInFlight
      }
    }

    const token = this.getToken()
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined ?? {}),
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })

    if (!res.ok) {
      // On 401, attempt a single refresh-and-retry cycle.
      if (res.status === 401 && retry && this.refresher) {
        if (!this.refreshInFlight) {
          this.refreshInFlight = this.refresher().finally(() => {
            this.refreshInFlight = null
          })
        }
        const refreshed = await this.refreshInFlight
        if (refreshed) {
          return this.request<T>(path, init, false /* no further retries */)
        }
      }

      const payload = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
      throw new ApiError(payload.error ?? res.statusText, res.status)
    }

    if (res.status === 204) return undefined as unknown as T
    return res.json() as Promise<T>
  }

  get<T>(path: string)                     { return this.request<T>(path) }
  post<T>(path: string, body?: unknown)    { return this.request<T>(path, { method: "POST", body }) }
  patch<T>(path: string, body?: unknown)   { return this.request<T>(path, { method: "PATCH", body }) }
  put<T>(path: string, body?: unknown)     { return this.request<T>(path, { method: "PUT", body }) }
  // Generic because not every DELETE answers 204 — some return `{ data }`
  // (e.g. cover-request withdrawal). Defaults to void so existing callers
  // that ignore the body are unaffected.
  del<T = void>(path: string)              { return this.request<T>(path, { method: "DELETE" }) }
}
