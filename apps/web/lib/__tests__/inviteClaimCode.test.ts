/**
 * Unit tests for lib/inviteClaimCode.ts (F-2 hardening).
 *
 * No Upstash env vars are set under test, so getRedis() returns null and the
 * module exercises its in-memory fallback path — which mirrors the Redis path's
 * semantics (hashed storage, single-use consumption, attempt cap).
 */
import { describe, it, expect } from "vitest"
import {
  generateClaimCode,
  storeClaimCode,
  verifyClaimCode,
} from "@/lib/inviteClaimCode"

describe("inviteClaimCode", () => {
  it("generates a zero-padded 6-digit code", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateClaimCode()).toMatch(/^\d{6}$/)
    }
  })

  it("verifies the correct code, then consumes it (single use)", async () => {
    const code = "123456"
    await storeClaimCode("emp-ok", code)

    expect(await verifyClaimCode("emp-ok", code)).toEqual({ ok: true })
    // Consumed — a second attempt with the same code now reads as expired/missing.
    expect(await verifyClaimCode("emp-ok", code)).toEqual({ ok: false, reason: "expired" })
  })

  it("rejects a wrong code as a mismatch without consuming a valid one", async () => {
    await storeClaimCode("emp-wrong", "111111")

    expect(await verifyClaimCode("emp-wrong", "222222")).toEqual({ ok: false, reason: "mismatch" })
    // The real code still works afterwards.
    expect(await verifyClaimCode("emp-wrong", "111111")).toEqual({ ok: true })
  })

  it("locks out after too many incorrect attempts", async () => {
    await storeClaimCode("emp-lock", "999999")

    // 5 attempts allowed; the 5th wrong attempt trips the cap and burns the code.
    for (let i = 0; i < 4; i++) {
      expect(await verifyClaimCode("emp-lock", "000000")).toEqual({ ok: false, reason: "mismatch" })
    }
    expect(await verifyClaimCode("emp-lock", "000000")).toEqual({ ok: false, reason: "too_many" })

    // Even the correct code no longer works — the record was cleared.
    expect(await verifyClaimCode("emp-lock", "999999")).toEqual({ ok: false, reason: "expired" })
  })

  it("returns expired when no code was ever stored", async () => {
    expect(await verifyClaimCode("emp-none", "123456")).toEqual({ ok: false, reason: "expired" })
  })
})
