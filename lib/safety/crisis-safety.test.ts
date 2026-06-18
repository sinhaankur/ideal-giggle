import { describe, expect, it } from "vitest"
import { assessCrisis, assessConversationSafety, type CrisisSeverity } from "./crisis-safety"

describe("assessCrisis — detection", () => {
  it("flags explicit suicidal statements as suicide", () => {
    for (const text of [
      "I want to kill myself",
      "I just want to die",
      "there's no reason to live anymore",
      "honestly I'd be better off dead",
      "I can't go on like this",
      "I feel suicidal tonight",
    ]) {
      const result = assessCrisis(text)
      expect(result.flagged, text).toBe(true)
      expect(result.kind, text).toBe("suicide")
    }
  })

  it("flags self-harm statements as self-harm", () => {
    for (const text of [
      "I want to hurt myself",
      "I've been cutting myself again",
      "I keep wanting to punish myself",
    ]) {
      const result = assessCrisis(text)
      expect(result.flagged, text).toBe(true)
      expect(result.kind, text).toBe("self-harm")
    }
  })

  it("flags threats toward others as harm-other", () => {
    const result = assessCrisis("I'm going to hurt someone if this doesn't stop")
    expect(result.flagged).toBe(true)
    expect(result.kind).toBe("harm-other")
  })
})

describe("assessCrisis — response content", () => {
  it("always includes at least one concrete, real resource", () => {
    const result = assessCrisis("I want to kill myself")
    expect(result.response).toContain("988")
    expect(result.response).toContain("findahelpline.com")
  })

  it("stays present rather than ejecting the user", () => {
    const result = assessCrisis("I want to die")
    expect(result.response.toLowerCase()).toMatch(/here|stay|with you/)
  })
})

describe("assessCrisis — negation guard", () => {
  it("does not flag clear negations", () => {
    for (const text of [
      "I don't want to die, I'm just exhausted",
      "I would never kill myself, don't worry",
    ]) {
      const result = assessCrisis(text)
      expect(result.flagged, text).toBe(false)
    }
  })
})

describe("assessCrisis — severity on crisis tier", () => {
  it("marks explicit danger as severity crisis", () => {
    expect(assessCrisis("I want to kill myself").severity).toBe("crisis")
    expect(assessCrisis("I want to hurt myself").severity).toBe("crisis")
  })
})

describe("assessCrisis — concern tier", () => {
  it("raises concern (not crisis) for soft hopelessness", () => {
    for (const text of [
      "what's the point of any of this anymore",
      "I just want to give up",
      "I feel like a burden to everyone",
      "I can't do this anymore",
      "honestly I hate my life",
    ]) {
      const result = assessCrisis(text)
      expect(result.severity, text).toBe("concern")
      // Concern must NOT trigger the hard pre-empt...
      expect(result.flagged, text).toBe(false)
      expect(result.response, text).toBe("")
      // ...but must hand the model gentle steering.
      expect(result.guidance.length, text).toBeGreaterThan(0)
    }
  })

  it("does not dump hotline numbers into concern guidance", () => {
    const result = assessCrisis("what's the point anymore")
    expect(result.guidance).not.toContain("988")
  })
})

describe("assessConversationSafety — rising-pattern escalation", () => {
  const C: CrisisSeverity = "concern"
  const N: CrisisSeverity = "none"

  it("does not escalate on a single concern", () => {
    expect(assessConversationSafety([C]).escalate).toBe(false)
  })

  it("escalates once concern recurs enough within the window", () => {
    const result = assessConversationSafety([C, N, C, C])
    expect(result.escalate).toBe(true)
    expect(result.message).toContain("988")
  })

  it("only escalates when the current turn is itself a concern", () => {
    // Three concerns earlier, but the latest turn settled — don't escalate.
    expect(assessConversationSafety([C, C, C, N]).escalate).toBe(false)
  })

  it("does not escalate on empty or all-clear history", () => {
    expect(assessConversationSafety([]).escalate).toBe(false)
    expect(assessConversationSafety([N, N, N]).escalate).toBe(false)
  })

  it("offers resources gently (keeps the door open)", () => {
    const result = assessConversationSafety([C, C, C])
    expect(result.message.toLowerCase()).toMatch(/not going anywhere|keep talking|with you/)
  })
})

describe("assessCrisis — non-crisis", () => {
  it("does not flag ordinary heavy-but-safe messages", () => {
    for (const text of [
      "work was rough today and I'm tired",
      "I'm sad about my breakup",
      "I feel stuck and unmotivated",
      "",
    ]) {
      const result = assessCrisis(text)
      expect(result.flagged, text).toBe(false)
      expect(result.severity, text).toBe("none")
      expect(result.kind, text).toBe(null)
      expect(result.response, text).toBe("")
    }
  })
})
