import { describe, expect, it } from "vitest"
import { checkRateLimit, chatRequestSchema, mcpFallbackRequestSchema } from "./request-guards"

describe("chatRequestSchema", () => {
  it("accepts a minimal valid payload", () => {
    const payload = {
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "hello" }],
        },
      ],
    }

    const parsed = chatRequestSchema.parse(payload)
    expect(parsed.messages).toHaveLength(1)
  })

  it("rejects invalid token limits", () => {
    const payload = {
      messages: [],
      maxOutputTokens: 0,
    }

    expect(() => chatRequestSchema.parse(payload)).toThrow()
  })
})

describe("mcpFallbackRequestSchema", () => {
  it("requires at least one message", () => {
    expect(() => mcpFallbackRequestSchema.parse({ messages: [] })).toThrow()
  })
})

describe("checkRateLimit", () => {
  it("blocks when over limit within the same window", () => {
    const baseNow = 1_000
    const key = "test-rate-limit"

    const first = checkRateLimit({ key, limit: 2, windowMs: 60_000, now: baseNow })
    const second = checkRateLimit({ key, limit: 2, windowMs: 60_000, now: baseNow + 1 })
    const third = checkRateLimit({ key, limit: 2, windowMs: 60_000, now: baseNow + 2 })

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(true)
    expect(third.allowed).toBe(false)
    expect(third.retryAfterSec).toBeGreaterThan(0)
  })

  it("resets after window passes", () => {
    const key = "test-rate-reset"
    const first = checkRateLimit({ key, limit: 1, windowMs: 1_000, now: 10_000 })
    const second = checkRateLimit({ key, limit: 1, windowMs: 1_000, now: 11_100 })

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(true)
  })
})