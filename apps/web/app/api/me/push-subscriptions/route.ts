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
import { requireAuth } from "@/lib/apiGuard"
import { db } from "@/lib/prisma"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"

const MAX_FIELD = 2048

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { endpoint, keys } = body
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "endpoint, keys.p256dh and keys.auth are required" }, { status: 400 })
  }
  if ([endpoint, keys.p256dh, keys.auth].some((v) => v.length > MAX_FIELD)) {
    return NextResponse.json({ error: "Field too long" }, { status: 400 })
  }
  if (!endpoint.startsWith("https://")) {
    return NextResponse.json({ error: "endpoint must be an https URL" }, { status: 400 })
  }

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

  let body: { endpoint?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 })
  }

  // Scoped to the caller — one user cannot unregister another user's device.
  await db.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint, userId: guard.userId },
  })
  return NextResponse.json({ data: { ok: true } })
}
