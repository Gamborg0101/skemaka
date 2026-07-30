import "server-only"
import webpush from "web-push"
import { db } from "@/lib/prisma"

/**
 * Web push via the browser Push API. Like SMS, this is a best-effort channel:
 * if VAPID keys are not configured the module is a silent no-op, so email
 * remains the reliable baseline everywhere push is used.
 *
 * Env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:).
 */

export interface PushPayload {
  title: string
  body: string
  /** Path to open when the notification is clicked, e.g. "/portal". */
  url?: string
}

let configured: boolean | null = null

function ensureConfigured(): boolean {
  if (configured !== null) return configured
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    configured = false
    return false
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:support@skemaka.com",
    publicKey,
    privateKey,
  )
  configured = true
  return true
}

/** True when push can actually send (VAPID keys present). */
export function isPushConfigured(): boolean {
  return ensureConfigured()
}

/**
 * Send a notification to every registered device of the given users.
 * Endpoints the push service reports as gone (404/410) are deleted, so the
 * table self-heals as browsers expire subscriptions. Never throws.
 *
 * Returns the number of successful deliveries.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (userIds.length === 0 || !ensureConfigured()) return 0

  let subs: Awaited<ReturnType<typeof db.pushSubscription.findMany>>
  try {
    subs = await db.pushSubscription.findMany({
      where: { userId: { in: userIds } },
    })
  } catch (err) {
    // The initial lookup runs outside the per-subscription try/catch below;
    // a DB blip here must not reject, or fire-and-forget callers (`void
    // sendPushToUsers(...)`) surface an unhandled rejection.
    console.error("[push] Failed to load subscriptions:", err)
    return 0
  }
  if (subs.length === 0) return 0

  const body = JSON.stringify(payload)
  const dead: string[] = []
  let delivered = 0

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        )
        delivered++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) dead.push(sub.id)
        // Other failures (throttling, transient network) are dropped silently —
        // push is best-effort and email is the reliable channel.
      }
    }),
  )

  if (dead.length > 0) {
    await db.pushSubscription.deleteMany({ where: { id: { in: dead } } }).catch(() => {})
  }
  return delivered
}
