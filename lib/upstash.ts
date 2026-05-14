import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

let _ratelimit: Ratelimit | null = null

function getRatelimit(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    return null
  }

  if (!_ratelimit) {
    const redis = new Redis({ url, token })
    _ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "10 s"),
      analytics: false,
    })
  }

  return _ratelimit
}

// Exported proxy — resolves lazily so import-time crash is avoided
export const ratelimit = new Proxy({} as Ratelimit, {
  get(_target, prop) {
    const instance = getRatelimit()
    if (!instance) throw new Error("Ratelimit not configured")
    return instance[prop as keyof Ratelimit]
  },
})

export async function rateLimitRequest(identifier: string): Promise<{ success: boolean }> {
  const instance = getRatelimit()

  // Dev mode: env vars missing — skip rate limiting
  if (!instance) {
    return { success: true }
  }

  const result = await instance.limit(identifier)
  return { success: result.success }
}
