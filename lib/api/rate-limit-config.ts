export type RateLimitPolicy = {
  limit: number
  windowMs: number
}

export type RateLimitConfigSnapshot = {
  windowMs: number
  globalLimit: number
  chatLimit: number
  fallbackLimit: number
  hasDistributedCredentials: boolean
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function getRateLimitConfigSnapshot(): RateLimitConfigSnapshot {
  const windowMs = parsePositiveInt(process.env.API_RATE_LIMIT_WINDOW_MS, 60_000)
  const globalLimit = parsePositiveInt(process.env.API_RATE_LIMIT_MAX, 90)
  const chatLimit = parsePositiveInt(process.env.API_RATE_LIMIT_CHAT_MAX, 60)
  const fallbackLimit = parsePositiveInt(process.env.API_RATE_LIMIT_FALLBACK_MAX, 40)
  const hasDistributedCredentials =
    Boolean(process.env.UPSTASH_REDIS_REST_URL) && Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)

  return {
    windowMs,
    globalLimit,
    chatLimit,
    fallbackLimit,
    hasDistributedCredentials,
  }
}

export function getRouteRateLimitPolicy(pathname: string): RateLimitPolicy {
  const snapshot = getRateLimitConfigSnapshot()

  if (pathname === "/api/chat") {
    return { limit: snapshot.chatLimit, windowMs: snapshot.windowMs }
  }

  if (pathname === "/api/mcp-fallback") {
    return { limit: snapshot.fallbackLimit, windowMs: snapshot.windowMs }
  }

  return { limit: snapshot.globalLimit, windowMs: snapshot.windowMs }
}

export function getLimiterMode() {
  return getRateLimitConfigSnapshot().hasDistributedCredentials ? "distributed" : "memory"
}