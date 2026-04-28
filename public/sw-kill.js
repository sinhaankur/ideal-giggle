// Kill-switch service worker.
// To use: rename this file to `sw.js` (replacing the live SW) and redeploy.
// Every client that visits will have its SW unregistered and Empatheia caches purged.
// After every client has loaded once with this in place, it is safe to delete sw.js entirely.

const CACHE_PREFIX = "empatheia-"

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(
          keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k))
        )
      } catch {
        // ignore
      }
      try {
        await self.registration.unregister()
      } catch {
        // ignore
      }
      try {
        const clientList = await self.clients.matchAll({ type: "window" })
        clientList.forEach((client) => {
          if ("navigate" in client) {
            client.navigate(client.url).catch(() => undefined)
          }
        })
      } catch {
        // ignore
      }
    })()
  )
})

// No fetch handler: requests pass straight through to the network.
