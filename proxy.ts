import { NextRequest, NextResponse } from "next/server"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { getRateLimitConfigSnapshot, getRouteRateLimitPolicy } from "@/lib/api/rate-limit-config"

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const limiterCache = new Map<string, Ratelimit>()

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim() || "unknown"
  return request.headers.get("x-real-ip") || "unknown"
}

function getDistributedLimiter(limit: number, windowMs: number) {
  const snapshot = getRateLimitConfigSnapshot()
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!snapshot.hasDistributedCredentials || !url || !token) return null

  const cacheKey = `${limit}:${windowMs}`
  const existing = limiterCache.get(cacheKey)
  if (existing) return existing

  const redis = new Redis({ url, token })
  const seconds = Math.max(1, Math.ceil(windowMs / 1000))
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${seconds} s`),
    analytics: false,
    prefix: "empatheia:rl",
  })

  limiterCache.set(cacheKey, limiter)
  return limiter
}

function checkLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const current = buckets.get(key)

  if (!current || now > current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSec: 0 }
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    }
  }

  current.count += 1
  buckets.set(key, current)
  return { allowed: true, retryAfterSec: 0 }
}

async function checkDistributedLimit(key: string, limit: number, windowMs: number) {
  const limiter = getDistributedLimiter(limit, windowMs)
  if (!limiter) return null

  const result = await limiter.limit(key)
  if (result.success) {
    return { allowed: true, retryAfterSec: 0 }
  }

  return {
    allowed: false,
    retryAfterSec: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
  }
}

export async function proxy(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.next()
  }

  const { limit, windowMs } = getRouteRateLimitPolicy(request.nextUrl.pathname)
  const ip = getClientIp(request)
  const key = `${request.nextUrl.pathname}:${ip}`
  const result = (await checkDistributedLimit(key, limit, windowMs)) ?? checkLimit(key, limit, windowMs)

  if (result.allowed) {
    return NextResponse.next()
  }

  return NextResponse.json(
    {
      error: "Too many requests",
      retryAfterSec: result.retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
      },
    }
  )
}

export const config = {
  matcher: ["/api/:path*"],
}