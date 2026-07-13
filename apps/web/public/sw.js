// Minimal service worker for installability + web push.
// Intentionally does NOT cache — it lets every request pass through to the
// network so app data is never served stale. Its jobs: exist with a fetch
// handler so Chrome/Android treat Skemaka as an installable PWA, and surface
// push notifications (new schedule published, etc.).
self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", () => {
  // No-op: fall through to the default network handling.
})

self.addEventListener("push", (event) => {
  let payload = { title: "Skemaka", body: "", url: "/" }
  try {
    payload = { ...payload, ...event.data.json() }
  } catch {
    // Malformed payload — show the generic notification.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Focus an existing app window if one is open, else open a new one.
      for (const client of windows) {
        if ("focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
