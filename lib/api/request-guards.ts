import { z } from "zod"

type RateLimitEntry = {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

const messagePartSchema = z
  .object({
    type: z.string().min(1).max(40),
    text: z.string().max(4000).optional(),
  })
  .passthrough()

const uiMessageSchema = z
  .object({
    id: z.string().min(1).max(120),
    role: z.string().min(1).max(40),
    parts: z.array(messagePartSchema).max(40).optional(),
  })
  .passthrough()

export const chatRequestSchema = z.object({
  messages: z.array(uiMessageSchema).max(120).default([]),
  emotion: z.string().max(40).optional(),
  personality: z.string().max(40).optional(),
  toneMode: z.string().max(40).optional(),
  provider: z.string().max(40).optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxOutputTokens: z.number().int().min(1).max(2000).optional(),
  contextMessages: z.number().int().min(1).max(50).optional(),
  empathySummary: z
    .object({
      says: z.number().int().min(0).max(500),
      thinks: z.number().int().min(0).max(500),
      does: z.number().int().min(0).max(500),
      feels: z.number().int().min(0).max(500),
    })
    .optional(),
  samanthaGuidance: z.string().max(12000).optional(),
  nextDeepQuestion: z.string().max(1000).optional(),
  companionName: z.string().max(120).optional(),
  empathyProfile: z.unknown().optional(),
  empathyCode: z.string().max(120).optional(),
  ollamaBaseUrl: z.string().max(300).optional(),
  ollamaModel: z.string().max(120).optional(),
  openRouterApiKey: z.string().max(300).optional(),
  openRouterModel: z.string().max(200).optional(),
})

const fallbackMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
})

export const mcpFallbackRequestSchema = z.object({
  messages: z.array(fallbackMessageSchema).min(1).max(80),
  mcpBaseUrl: z.string().trim().max(300).optional(),
  mcpModel: z.string().trim().max(120).optional(),
  mcpApiKey: z.string().max(300).optional(),
  systemPrompt: z.string().trim().max(12000).optional(),
})

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim() || "unknown"
  }

  return request.headers.get("x-real-ip") || "unknown"
}

export function checkRateLimit(params: {
  key: string
  limit: number
  windowMs: number
  now?: number
}) {
  const { key, limit, windowMs, now = Date.now() } = params
  const existing = rateLimitStore.get(key)

  if (!existing || now > existing.resetAt) {
    const next = { count: 1, resetAt: now + windowMs }
    rateLimitStore.set(key, next)
    return { allowed: true, retryAfterSec: 0 }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  rateLimitStore.set(key, existing)
  return { allowed: true, retryAfterSec: 0 }
}

export function rateLimitJsonResponse(retryAfterSec: number) {
  return Response.json(
    {
      error: "Too many requests",
      retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
      },
    }
  )
}

export function badRequestFromZod(error: z.ZodError) {
  return Response.json(
    {
      error: "Invalid request body",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 }
  )
}