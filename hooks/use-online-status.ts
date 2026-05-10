"use client"

import { useEffect, useState } from "react"

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true)

  useEffect(() => {
    if (typeof window === "undefined") return
    const apply = () => setIsOnline(navigator.onLine)
    apply()
    window.addEventListener("online", apply)
    window.addEventListener("offline", apply)
    return () => {
      window.removeEventListener("online", apply)
      window.removeEventListener("offline", apply)
    }
  }, [])

  return isOnline
}
