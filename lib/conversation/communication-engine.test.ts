import { describe, expect, it } from "vitest"
import {
  buildLocalCompanionReply,
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

  it("returns concrete WebLLM status guidance when runtime is not ready", () => {
    const reply = buildLocalCompanionReply(
      "is the model connected?",
      0,
      "What part feels sharpest right now?",
      {
        provider: "webllm",
        webLlmStatus: "downloading",
        systemHealth: "initializing",
      }
    )

    expect(reply).toMatch(/WebLLM is currently downloading/i)
    expect(reply).toMatch(/Initialize the model|switch provider/i)
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