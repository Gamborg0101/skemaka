/**
 * POST   /api/me/push-subscriptions — register this browser's push subscription
 *        Body: { endpoint, keys: { p256dh, auth } } (PushSubscription.toJSON())
 * DELETE /api/me/push-subscriptions — remove a subscription
 *        Body: { endpoint }
 *
 * Subscriptions belong to the authenticated user. An endpoint re-registered by
 * a different user is reassigned (same physical browser, new login).
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, parseBody } from "@/lib/apiGuard"
import { db } from "@/lib/prisma"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"

const MAX_FIELD = 2048

const SubscribeSchema = z.object({
  endpoint: z.string().min(1, "endpoint, keys.p256dh and keys.auth are required").max(MAX_FIELD, "Field too long").startsWith("https://", "endpoint must be an https URL"),
  keys: z.object({
    p256dh: z.string().min(1, "endpoint, keys.p256dh and keys.auth are required").max(MAX_FIELD, "Field too long"),
    auth:   z.string().min(1, "endpoint, keys.p256dh and keys.auth are required").max(MAX_FIELD, "Field too long"),
  }),
})

const UnsubscribeSchema = z.object({
  endpoint: z.string().min(1, "endpoint is required"),
})

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const parsed = await parseBody(req, SubscribeSchema)
  if ("error" in parsed) return parsed.error
  const { endpoint, keys } = parsed.data

  const userAgent = req.headers.get("user-agent")?.slice(0, 255) ?? null
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: guard.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    update: { userId: guard.userId, p256dh: keys.p256dh, auth: keys.auth, userAgent },
  })

  return NextResponse.json({ data: { ok: true } }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  const parsed = await parseBody(req, UnsubscribeSchema)
  if ("error" in parsed) return parsed.error

  // Scoped to the caller — one user cannot unregister another user's device.
  await db.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: guard.userId },
  })
  return NextResponse.json({ data: { ok: true } })
}
