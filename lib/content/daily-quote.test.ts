import { describe, expect, it } from "vitest"
import { getDailyQuote, QUOTES } from "./daily-quote"

describe("getDailyQuote", () => {
  it("returns a two-line quote with non-empty lines", () => {
    const q = getDailyQuote(new Date("2026-06-18T09:00:00"))
    expect(q.line1.length).toBeGreaterThan(0)
    expect(q.line2.length).toBeGreaterThan(0)
  })

  it("is stable across the same calendar day", () => {
    const morning = getDailyQuote(new Date("2026-06-18T06:00:00"))
    const night = getDailyQuote(new Date("2026-06-18T23:30:00"))
    expect(morning).toEqual(night)
  })

  it("changes from one day to the next", () => {
    const day1 = getDailyQuote(new Date("2026-06-18T12:00:00"))
    const day2 = getDailyQuote(new Date("2026-06-19T12:00:00"))
    expect(day1).not.toEqual(day2)
  })

  it("walks the whole list before repeating", () => {
    const seen = new Set<string>()
    const base = new Date("2026-01-01T12:00:00").getTime()
    for (let i = 0; i < QUOTES.length; i++) {
      const q = getDailyQuote(new Date(base + i * 86_400_000))
      seen.add(`${q.line1}|${q.line2}`)
    }
    // Every distinct quote appears exactly once across one full cycle.
    expect(seen.size).toBe(QUOTES.length)
  })

  it("never throws and stays in range over a long span", () => {
    const base = new Date("2020-01-01T00:00:00").getTime()
    for (let i = 0; i < 800; i += 37) {
      const q = getDailyQuote(new Date(base + i * 86_400_000))
      expect(QUOTES).toContainEqual(q)
    }
  })
})
