import { describe, expect, it } from "vitest"
import { buildLocalCompanionReply, inferUserUnderstanding } from "./communication-engine"

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