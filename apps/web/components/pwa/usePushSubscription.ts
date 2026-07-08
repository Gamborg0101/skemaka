"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Client side of web push. Wraps permission + PushManager subscription and
 * keeps the server informed via /api/me/push-subscriptions.
 *
 * status:
 *  - "unsupported" — browser can't push, or VAPID key not configured
 *  - "default"     — supported, permission not asked yet
 *  - "denied"      — user blocked notifications (browser-level, we can't undo)
 *  - "subscribed"  — permission granted and this device is registered
 */
export type PushStatus = "unsupported" | "default" | "denied" | "subscribed" | "loading"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(b64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(VAPID_PUBLIC_KEY)
  )
}

async function registerWithServer(sub: PushSubscription): Promise<void> {
  await fetch("/api/me/push-subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  })
}

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>("loading")

  useEffect(() => {
    if (!isSupported()) {
      setStatus("unsupported")
      return
    }
    if (Notification.permission === "denied") {
      setStatus("denied")
      return
    }
    if (Notification.permission === "default") {
      setStatus("default")
      return
    }
    // Permission already granted — sync the existing subscription (or create
    // one) so a re-login or cleared server row heals itself silently.
    let cancelled = false
    navigator.serviceWorker.ready
      .then(async (reg) => {
        const existing = await reg.pushManager.getSubscription()
        const sub =
          existing ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
          }))
        await registerWithServer(sub)
        if (!cancelled) setStatus("subscribed")
      })
      .catch(() => {
        if (!cancelled) setStatus("default")
      })
    return () => { cancelled = true }
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported()) return false
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "default")
        return false
      }
      const reg = await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
        }))
      await registerWithServer(sub)
      setStatus("subscribed")
      return true
    } catch {
      setStatus("default")
      return false
    }
  }, [])

  return { status, subscribe }
}
