import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

let _redis: Redis | null = null
let _ratelimit: Ratelimit | null = null

export function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  if (!_redis) _redis = new Redis({ url, token })
  return _redis
}

function getRatelimit(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    return null
  }

  if (!_ratelimit) {
    const redis = getRedis()!
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

if (process.env.NODE_ENV === "production" && !getRatelimit()) {
  console.error(
    "[UPSTASH] Rate limiting is DISABLED — set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"
  )
}

// Prefer x-real-ip (set by Vercel, cannot be forged by clients) over
// x-forwarded-for (can be sent by the client and is attacker-controlled on
// non-Vercel deployments). Falls back to "anonymous" when neither is present.
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "anonymous"
  )
}

export async function rateLimitRequest(identifier: string): Promise<{ success: boolean }> {
  const instance = getRatelimit()

  // Dev mode: env vars missing — skip rate limiting
  if (!instance) {
    return { success: true }
  }

  const result = await instance.limit(identifier)
  return { success: result.success }
}
