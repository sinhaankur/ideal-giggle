import { describe, expect, it } from "vitest"
import {
  buildLocalCompanionReply,
  composeConversationSummary,
  describeFeltState,
  inferUserUnderstanding,
  suggestPromptsFromFeltState,
  summarizeFeltState,
} from "./communication-engine"

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

describe("buildLocalCompanionReply runtime status behavior", () => {
  it("returns concrete fallback status details for 'Is AI running?' when connection is down", () => {
    const reply = buildLocalCompanionReply(
      "Is AI running?",
      -0.1,
      "What feels most true right now?",
      {
        provider: "ollama",
        llmConnectionError: "connect ECONNREFUSED 127.0.0.1:11434",
        systemHealth: "fallback",
        ollamaBaseUrl: "http://127.0.0.1:11434",
        ollamaModel: "llama3.2",
      }
    )

    expect(reply).toMatch(/fallback mode/i)
    expect(reply).toMatch(/provider:\s*OLLAMA/i)
    expect(reply).toMatch(/ECONNREFUSED/i)
    expect(reply).not.toMatch(/go one layer deeper|what feels most true right now/i)
  })

  it("returns Ollama mode guidance when provider is Ollama and the runtime is healthy", () => {
    const reply = buildLocalCompanionReply(
      "is the model connected?",
      0,
      "What part feels sharpest right now?",
      {
        provider: "ollama",
        systemHealth: "ready",
        ollamaBaseUrl: "http://127.0.0.1:11434",
        ollamaModel: "llama3.2",
      }
    )

    expect(reply).toMatch(/Ollama mode is active/i)
    expect(reply).toMatch(/127\.0\.0\.1:11434/)
    expect(reply).not.toMatch(/what part feels sharpest right now/i)
  })
})

describe("describeFeltState", () => {
  it("surfaces primary + secondary descriptors and a body hint when present", () => {
    const state = describeFeltState(
      "I feel anxious and exhausted, my chest is tight and I cant breathe right",
      "fear"
    )

    expect(state.primary).toBe("anxious")
    expect(state.secondary).toBe("exhausted")
    expect(state.bodyHint).toBe("tight chest")
    expect(state.confidence).toBe("high")
  })

  it("infers venting intent and matching need", () => {
    const state = describeFeltState(
      "I am tired of this, I am frustrated and just done with it"
    )

    expect(state.intent).toBe("venting")
    expect(state.need).toMatch(/heard without being fixed/i)
  })

  it("falls back gracefully when no signal text is provided", () => {
    const state = describeFeltState("", "neutral")

    expect(state.primary).toBe("settling in")
    expect(state.confidence).toBe("low")
    expect(summarizeFeltState(state)).toBe("settling in")
  })

  it("marks faceContributed when a trustworthy face signal backs a non-neutral read", () => {
    const state = describeFeltState("I feel a bit low today", "sad", {
      emotion: "sad",
      confidence: 0.9,
      engagement: 0.9,
    })
    expect(state.faceContributed).toBe(true)
  })

  it("does not mark faceContributed for a weak/low-quality face signal", () => {
    const state = describeFeltState("I feel a bit low today", "sad", {
      emotion: "sad",
      confidence: 0.2,
      engagement: 0.2,
    })
    expect(state.faceContributed).toBe(false)
  })

  it("does not mark faceContributed when the camera is neutral", () => {
    const state = describeFeltState("I feel a bit low today", "neutral", {
      emotion: "neutral",
      confidence: 0.95,
      engagement: 0.95,
    })
    expect(state.faceContributed).toBe(false)
  })

  it("does not mark faceContributed when no face signal is supplied", () => {
    const state = describeFeltState("I feel a bit low today", "sad")
    expect(state.faceContributed).toBe(false)
  })
})

describe("suggestPromptsFromFeltState", () => {
  it("returns primary-tag-tailored prompts as the first option", () => {
    const state = describeFeltState("I am lonely and just want to feel heard")
    const prompts = suggestPromptsFromFeltState(state)

    expect(prompts.length).toBeGreaterThan(0)
    expect(prompts[0]).toMatch(/heard|stay with me|reflect/i)
  })

  it("blends primary and secondary tags when both are present", () => {
    const state = describeFeltState(
      "I am overwhelmed and exhausted, everything feels like too much"
    )
    const prompts = suggestPromptsFromFeltState(state)

    expect(prompts.length).toBeGreaterThanOrEqual(2)
    // Should pull at least one prompt that maps to "overwhelmed" or
    // "exhausted" rather than only generic ones.
    expect(prompts.some((p) => /smaller|drop|attention|rest|witness/i.test(p))).toBe(true)
  })

  it("never returns more than three prompts", () => {
    const state = describeFeltState("I am anxious and tense and stuck and tired and wistful")
    const prompts = suggestPromptsFromFeltState(state)

    expect(prompts.length).toBeLessThanOrEqual(3)
  })

  it("yields a settling-in prompt when no signal is detected", () => {
    const state = describeFeltState("hello", "neutral")
    const prompts = suggestPromptsFromFeltState(state)

    expect(prompts.length).toBeGreaterThan(0)
    expect(prompts[0]).toMatch(/arrive|first thing|gently/i)
  })
})

describe("composeConversationSummary — emotional arc", () => {
  const base = {
    userTurnCount: 8,
    empathyData: { says: [], thinks: ["I keep second-guessing myself"], does: [], feels: ["tired"] },
    feltState: null,
    empathyCode: "",
    durationMinutes: 12,
  }

  it("names a softening trajectory when sentiment rises", () => {
    const summary = composeConversationSummary({
      ...base,
      sentimentTrajectory: [-0.8, -0.7, -0.4, -0.1, 0.2, 0.5],
    })
    expect(summary.paragraphs.join(" ")).toMatch(/soften|lighter|warm/i)
  })

  it("names a heavier trajectory when sentiment falls", () => {
    const summary = composeConversationSummary({
      ...base,
      sentimentTrajectory: [0.4, 0.2, -0.1, -0.4, -0.7, -0.9],
    })
    expect(summary.paragraphs.join(" ")).toMatch(/heavier|room to be felt/i)
  })

  it("omits the arc line when there is too little signal", () => {
    const summary = composeConversationSummary({ ...base, sentimentTrajectory: [0.1] })
    expect(summary.paragraphs.join(" ")).not.toMatch(/softened|heavier|steady ground/i)
  })

  it("is backward-compatible when no trajectory is provided", () => {
    const summary = composeConversationSummary(base)
    expect(summary.paragraphs.length).toBeGreaterThan(0)
  })
})

describe("composeConversationSummary — closing send-off", () => {
  const base = {
    userTurnCount: 6,
    empathyData: { says: [], thinks: [], does: [], feels: ["overwhelmed and tired"] },
    feltState: null,
    empathyCode: "",
    durationMinutes: 10,
  }

  it("adds a warm keepable closing line when closing is set", () => {
    const summary = composeConversationSummary({ ...base, closing: true })
    expect(summary.paragraphs.join(" ")).toMatch(/Before you go/i)
    // It should quote the feeling the person named.
    expect(summary.paragraphs.join(" ")).toMatch(/overwhelmed and tired/i)
  })

  it("omits the closing line by default", () => {
    const summary = composeConversationSummary(base)
    expect(summary.paragraphs.join(" ")).not.toMatch(/Before you go/i)
  })
})