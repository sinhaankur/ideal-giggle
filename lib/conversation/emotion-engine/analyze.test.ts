import { describe, expect, it } from "vitest"
import { analyzeEmotion } from "./analyze"
import { findDyad, PLUTCHIK_DYADS, PLUTCHIK_OPPOSITES } from "./plutchik"

describe("analyzeEmotion", () => {
  it("identifies a single primary from a clear emotion word", () => {
    const reading = analyzeEmotion("I'm so happy today")
    expect(reading.primary.name).toBe("joy")
    expect(reading.primary.weight).toBeGreaterThan(0)
    // "so" is an amplifier; intensity should not be "low"
    expect(reading.primary.intensity).not.toBe("low")
  })

  it("handles negation by routing to the polar opposite at half strength", () => {
    const positive = analyzeEmotion("I am happy")
    const negated = analyzeEmotion("I am not happy")
    expect(positive.primary.name).toBe("joy")
    expect(negated.primary.name).toBe("sadness") // joy's opposite
    expect(negated.primary.weight).toBeLessThan(positive.primary.weight)
  })

  it("blends two co-occurring emotions into a Plutchik dyad", () => {
    // joy + trust = love (primary dyad)
    const reading = analyzeEmotion("I feel loved and grateful and held by them")
    expect(reading.primary.name === "joy" || reading.primary.name === "trust").toBe(true)
    expect(reading.dyad?.name).toBe("love")
    expect(reading.dyad?.tier).toBe("primary")
  })

  it("recognizes the despair dyad (fear + sadness)", () => {
    const reading = analyzeEmotion("I'm anxious and exhausted, I can't breathe and feel hopeless")
    // primary should be fear or sadness; the other should be the secondary
    const names = [reading.primary.name, reading.secondary?.name]
    expect(names).toContain("fear")
    expect(names).toContain("sadness")
    expect(reading.dyad?.name).toBe("despair")
  })

  it("never blends polar opposites into a dyad", () => {
    // Force a tie of opposites with both words explicit
    const reading = analyzeEmotion("I'm happy and sad at the same time")
    if (reading.primary && reading.secondary) {
      expect(PLUTCHIK_OPPOSITES[reading.primary.name]).not.toBe(reading.secondary.name)
    }
    expect(reading.dyad).toBeNull()
  })

  it("amplifies intensity from 'so' / 'really' modifiers", () => {
    const plain = analyzeEmotion("I am angry")
    const amplified = analyzeEmotion("I am really really angry")
    expect(amplified.primary.weight).toBeGreaterThan(plain.primary.weight)
  })

  it("dampens intensity from 'kind of' / 'a little'", () => {
    const plain = analyzeEmotion("I am angry")
    const dampened = analyzeEmotion("I am kind of angry")
    expect(dampened.primary.weight).toBeLessThan(plain.primary.weight)
  })

  it("detects body anchors", () => {
    const reading = analyzeEmotion("my chest is tight and my heart is racing")
    expect(reading.bodyAnchors).toContain("tight chest")
    expect(reading.bodyAnchors).toContain("racing heart")
  })

  it("falls back to anticipation/low with low confidence on empty input", () => {
    const reading = analyzeEmotion("")
    expect(reading.confidence).toBe("low")
    expect(reading.primary.weight).toBe(0)
  })

  it("nudges toward the camera-detected emotion as a tie-breaker", () => {
    // No emotion-bearing text, just a camera signal. matchedTokens is
    // text-only by design, but the camera nudge still surfaces the
    // emotion as the primary.
    const noText = analyzeEmotion("I'm not sure", "happy")
    expect(noText.primary.name === "joy" || noText.secondary?.name === "joy").toBe(true)
    expect(noText.primary.weight).toBeGreaterThan(0)
  })

  it("returns valence in the negative half for sad input", () => {
    const reading = analyzeEmotion("I feel hopeless and devastated")
    expect(reading.valence).toBeLessThan(0)
  })

  it("returns high arousal for panic / fear input", () => {
    const reading = analyzeEmotion("I'm panicking and terrified")
    expect(reading.arousal).toBeGreaterThan(0.6)
  })
})

describe("Plutchik dyad table", () => {
  it("contains all 24 named dyads", () => {
    expect(PLUTCHIK_DYADS.length).toBe(24)
  })

  it("findDyad returns null for polar opposites", () => {
    expect(findDyad("joy", "sadness")).toBeNull()
    expect(findDyad("fear", "anger")).toBeNull()
  })

  it("findDyad returns the same dyad regardless of argument order", () => {
    const a = findDyad("joy", "trust")
    const b = findDyad("trust", "joy")
    expect(a?.name).toBe("love")
    expect(b?.name).toBe("love")
    expect(a).toBe(b)
  })
})
