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

export class ApiClient {
  private refresher: Refresher | null = null
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

  private async request<T>(
    path: string,
    init: RequestOptions = {},
    retry = true,
  ): Promise<T> {
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
  del(path: string)                        { return this.request<void>(path, { method: "DELETE" }) }
}
