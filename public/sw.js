const VERSION = "v1"
const RUNTIME_CACHE = `empatheia-runtime-${VERSION}`
const SHELL_CACHE = `empatheia-shell-${VERSION}`
const SHELL_URLS = ["/", "/manifest.webmanifest"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== RUNTIME_CACHE && k !== SHELL_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

function isApiRequest(url) {
  return url.pathname.startsWith("/api/")
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/static/") ||
    /\.(?:png|jpg|jpeg|svg|gif|ico|webp|woff2?|ttf|otf|css|js|map)$/i.test(url.pathname)
  )
}

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isApiRequest(url)) return

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy)).catch(() => undefined)
          return response
        })
        .catch(() =>
          caches.match("/").then((cached) => cached || caches.match(request))
        )
    )
    return
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone()
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined)
          }
          return response
        })
      })
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined)
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
