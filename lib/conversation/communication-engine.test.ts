import { describe, expect, it } from "vitest"
import { inferUserUnderstanding } from "./communication-engine"

describe("inferUserUnderstanding", () => {
  it("detects a check-in intent", () => {
    const result = inferUserUnderstanding("How are you doing today?")

    expect(result.primaryIntent).toBe("check-in")
    expect(result.emotionalLoad).toBe("low")
  })

  it("detects high-load venting", () => {
    const result = inferUserUnderstanding(
      "I am overwhelmed and exhausted, I hate that this keeps happening and I feel stuck"
    )

    expect(result.primaryIntent).toBe("venting")
    expect(result.emotionalLoad).toBe("high")
  })

  it("detects structured style requests", () => {
    const result = inferUserUnderstanding("Please break it down step by step with a clear framework")

    expect(result.preferredResponseStyle).toBe("structured")
    expect(result.primaryIntent).toBe("problem-solving")
  })
})