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

// Dev/test fallback only. Single-process, so it works for `pnpm dev` and e2e.
const memStore = new Map<string, { rec: CodeRecord; expiresAt: number }>()

function redisKey(employeeId: string): string {
  return `claim:otp:${employeeId}`
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

/** Store (overwriting any prior) the code for an employee. Resets attempts. */
export async function storeClaimCode(employeeId: string, code: string): Promise<void> {
  const rec: CodeRecord = { hash: hashCode(code), attempts: 0 }
  const redis = getRedis()
  if (redis) {
    await redis.set(redisKey(employeeId), rec, { ex: TTL_SECONDS })
    return
  }
  memStore.set(employeeId, { rec, expiresAt: Date.now() + TTL_SECONDS * 1000 })
}

export type VerifyResult = { ok: true } | { ok: false; reason: "expired" | "too_many" | "mismatch" }

async function readRecord(employeeId: string): Promise<CodeRecord | null> {
  const redis = getRedis()
  if (redis) {
    return (await redis.get<CodeRecord>(redisKey(employeeId))) ?? null
  }
  const entry = memStore.get(employeeId)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    memStore.delete(employeeId)
    return null
  }
  return entry.rec
}

async function writeRecord(employeeId: string, rec: CodeRecord): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.set(redisKey(employeeId), rec, { ex: TTL_SECONDS })
    return
  }
  const entry = memStore.get(employeeId)
  if (entry) entry.rec = rec
}

async function clearRecord(employeeId: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.del(redisKey(employeeId))
    return
  }
  memStore.delete(employeeId)
}

/**
 * Verify a submitted code against the stored one. Consumes the code on success
 * and on exhausting the attempt cap, so a verified or burned code cannot be
 * reused.
 */
export async function verifyClaimCode(employeeId: string, code: string): Promise<VerifyResult> {
  const rec = await readRecord(employeeId)
  if (!rec) return { ok: false, reason: "expired" }

  if (rec.attempts >= MAX_ATTEMPTS) {
    await clearRecord(employeeId)
    return { ok: false, reason: "too_many" }
  }

  if (hashesEqual(rec.hash, hashCode(code))) {
    await clearRecord(employeeId)
    return { ok: true }
  }

  rec.attempts += 1
  if (rec.attempts >= MAX_ATTEMPTS) {
    await clearRecord(employeeId)
    return { ok: false, reason: "too_many" }
  }
  await writeRecord(employeeId, rec)
  return { ok: false, reason: "mismatch" }
}
