"use client"

import { useEffect } from "react"

const CACHE_PREFIX = "empatheia-"

async function purgeServiceWorker() {
  if (!("serviceWorker" in navigator)) return
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((r) => r.unregister()))
  } catch {
    // ignore
  }
  if (typeof caches !== "undefined") {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k)))
    } catch {
      // ignore
    }
  }
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    const params = new URLSearchParams(window.location.search)
    if (params.get("reset-sw") === "1") {
      purgeServiceWorker().then(() => {
        params.delete("reset-sw")
        const cleaned = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`
        window.location.replace(cleaned)
      })
      return
    }

    if (process.env.NODE_ENV !== "production") {
      // Strip any SW that was registered by an earlier prod build viewed on this origin.
      purgeServiceWorker()
      return
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failure is non-fatal; app still works without SW.
      })
    }

    if (document.readyState === "complete") {
      register()
    } else {
      window.addEventListener("load", register, { once: true })
    }
  }, [])

  return null
}
