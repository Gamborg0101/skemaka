/**
 * One-time codes for claiming an employee invite (F-2 hardening).
 *
 * The invite link alone no longer proves identity: to link an account to an
 * employee record the caller must also enter a 6-digit code emailed to the
 * employee's authoritative address. A forwarded/leaked link is therefore
 * insufficient — the claimant must control the employee's inbox.
 *
 * Codes are stored hashed (HMAC-SHA256 keyed on AUTH_SECRET), expire after
 * TTL_SECONDS, and are attempt-capped. Redis is the store of record (it is a
 * required dependency in production — see instrumentation.ts). The in-memory
 * fallback exists only so local dev / e2e work without Upstash; it is never the
 * store in production.
 */
import { createHmac, timingSafeEqual, randomInt } from "crypto"
import { getRedis } from "@/lib/upstash"

const TTL_SECONDS = 10 * 60
const MAX_ATTEMPTS = 5

type CodeRecord = { hash: string; attempts: number }

/**
 * Which one-time-code flow a record belongs to. "claim" is the original email
 * invite-claim code (keyed by employeeId); "phone" is the SMS phone-verification
 * code (keyed by userId). The scope namespaces the Redis key so the two never
 * collide. Defaults to "claim" so existing callers are unchanged.
 */
export type CodeScope = "claim" | "phone"

// Dev/test fallback only. Single-process, so it works for `npm run dev` and e2e.
const memStore = new Map<string, { rec: CodeRecord; expiresAt: number }>()

function redisKey(id: string, scope: CodeScope): string {
  return `${scope}:otp:${id}`
}

/** Same namespacing for the in-memory fallback so scopes don't clash there either. */
function memKey(id: string, scope: CodeScope): string {
  return `${scope}:${id}`
}

function hashCode(code: string): string {
  const secret = process.env.AUTH_SECRET ?? ""
  return createHmac("sha256", secret).update(code).digest("hex")
}

/** Constant-time compare of two equal-length hex digests. */
function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/** A cryptographically-random, zero-padded 6-digit code. */
export function generateClaimCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0")
}

/**
 * Store (overwriting any prior) the code for an id. Resets attempts. `id` is an
 * employeeId for the "claim" scope and a userId for the "phone" scope.
 */
export async function storeClaimCode(id: string, code: string, scope: CodeScope = "claim"): Promise<void> {
  const rec: CodeRecord = { hash: hashCode(code), attempts: 0 }
  const redis = getRedis()
  if (redis) {
    await redis.set(redisKey(id, scope), rec, { ex: TTL_SECONDS })
    return
  }
  memStore.set(memKey(id, scope), { rec, expiresAt: Date.now() + TTL_SECONDS * 1000 })
}

export type VerifyResult = { ok: true } | { ok: false; reason: "expired" | "too_many" | "mismatch" }

async function readRecord(id: string, scope: CodeScope): Promise<CodeRecord | null> {
  const redis = getRedis()
  if (redis) {
    return (await redis.get<CodeRecord>(redisKey(id, scope))) ?? null
  }
  const entry = memStore.get(memKey(id, scope))
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    memStore.delete(memKey(id, scope))
    return null
  }
  return entry.rec
}

async function writeRecord(id: string, rec: CodeRecord, scope: CodeScope): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.set(redisKey(id, scope), rec, { ex: TTL_SECONDS })
    return
  }
  const entry = memStore.get(memKey(id, scope))
  if (entry) entry.rec = rec
}

async function clearRecord(id: string, scope: CodeScope): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.del(redisKey(id, scope))
    return
  }
  memStore.delete(memKey(id, scope))
}

/**
 * Verify a submitted code against the stored one. Consumes the code on success
 * and on exhausting the attempt cap, so a verified or burned code cannot be
 * reused.
 */
export async function verifyClaimCode(id: string, code: string, scope: CodeScope = "claim"): Promise<VerifyResult> {
  const rec = await readRecord(id, scope)
  if (!rec) return { ok: false, reason: "expired" }

  if (rec.attempts >= MAX_ATTEMPTS) {
    await clearRecord(id, scope)
    return { ok: false, reason: "too_many" }
  }

  if (hashesEqual(rec.hash, hashCode(code))) {
    await clearRecord(id, scope)
    return { ok: true }
  }

  rec.attempts += 1
  if (rec.attempts >= MAX_ATTEMPTS) {
    await clearRecord(id, scope)
    return { ok: false, reason: "too_many" }
  }
  await writeRecord(id, rec, scope)
  return { ok: false, reason: "mismatch" }
}
