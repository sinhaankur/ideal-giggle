import { describe, expect, it } from "vitest"
import { splitIntoBeats } from "./message-beats"

describe("splitIntoBeats", () => {
  it("returns a single beat for empty or whitespace text", () => {
    expect(splitIntoBeats("")).toEqual([""])
    expect(splitIntoBeats("   ")).toEqual([""])
  })

  it("keeps a short single-sentence reply as one beat", () => {
    expect(splitIntoBeats("That makes sense.")).toEqual(["That makes sense."])
  })

  it("honors explicit paragraph breaks the model produced", () => {
    const text = "I hear how heavy that felt.\n\nWhat part of it is loudest right now?"
    expect(splitIntoBeats(text)).toEqual([
      "I hear how heavy that felt.",
      "What part of it is loudest right now?",
    ])
  })

  it("peels a trailing question off a run-on reflection", () => {
    const text =
      "When you say you're 'just tired', it sounds like more than sleep. What's the thing under the tiredness?"
    expect(splitIntoBeats(text)).toEqual([
      "When you say you're 'just tired', it sounds like more than sleep.",
      "What's the thing under the tiredness?",
    ])
  })

  it("does not split a reply that is only a question", () => {
    expect(splitIntoBeats("What's been on your mind lately?")).toEqual([
      "What's been on your mind lately?",
    ])
  })

  it("does not split when the reply does not end in a question", () => {
    const text = "I'm right here with you. Take all the time you need."
    expect(splitIntoBeats(text)).toEqual([text])
  })

  it("does not peel off a trivially short trailing fragment", () => {
    expect(splitIntoBeats("I understand. Ok?")).toEqual(["I understand. Ok?"])
  })
})
