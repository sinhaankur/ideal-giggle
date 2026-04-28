import { describe, expect, it } from "vitest"
import { selectFromQABank, listQABankIds } from "./qa-bank"
import type { UserUnderstanding } from "./communication-engine"

const baseUnderstanding: UserUnderstanding = {
  primaryIntent: "reflection",
  emotionalLoad: "moderate",
  openness: "medium",
  preferredResponseStyle: "gentle",
  needs: [],
}

describe("selectFromQABank", () => {
  it("routes high-load venting to the vent-high-load entry", () => {
    const picked = selectFromQABank(
      {
        emotion: "neutral",
        understanding: { ...baseUnderstanding, primaryIntent: "venting", emotionalLoad: "high" },
        sentimentScore: -0.4,
      },
      42
    )

    expect(picked.entryId).toBe("vent-high-load")
    expect(picked.reflection).not.toBe("")
    expect(picked.question).not.toBe("")
  })

  it("routes fear emotion to the fear-grounded entry", () => {
    const picked = selectFromQABank(
      {
        emotion: "fear",
        understanding: baseUnderstanding,
        sentimentScore: -0.2,
      },
      7
    )

    expect(picked.entryId).toBe("fear-grounded")
  })

  it("falls back to the default entry when nothing else matches", () => {
    const picked = selectFromQABank(
      {
        emotion: "neutral",
        understanding: { ...baseUnderstanding, primaryIntent: "connection", openness: "medium" },
        sentimentScore: 0,
      },
      1
    )

    expect(picked.entryId).toBe("default")
  })

  it("varies output across seeds within the same entry", () => {
    const signal = {
      emotion: "happy" as const,
      understanding: baseUnderstanding,
      sentimentScore: 0.5,
    }
    const a = selectFromQABank(signal, 1)
    const b = selectFromQABank(signal, 2)
    const c = selectFromQABank(signal, 3)

    expect(a.entryId).toBe("happy-anchor")
    expect(b.entryId).toBe("happy-anchor")
    expect(c.entryId).toBe("happy-anchor")
    // At least one of {a, b, c} should differ in reflection or question — not all identical.
    const allSame =
      a.reflection === b.reflection &&
      b.reflection === c.reflection &&
      a.question === b.question &&
      b.question === c.question
    expect(allSame).toBe(false)
  })

  it("exposes a stable list of bank ids", () => {
    const ids = listQABankIds()
    expect(ids).toContain("default")
    expect(ids).toContain("vent-high-load")
    expect(ids.length).toBeGreaterThan(5)
  })
})
