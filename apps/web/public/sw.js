// Minimal service worker for installability.
// Intentionally does NOT cache — it lets every request pass through to the
// network so app data is never served stale. Its only job is to exist with a
// fetch handler so Chrome/Android treat Skemaka as an installable PWA.
self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", () => {
  // No-op: fall through to the default network handling.
})
