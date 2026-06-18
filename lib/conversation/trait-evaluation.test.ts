import { describe, expect, it } from "vitest"
import { evaluateTraits, type TraitEvaluationInput } from "./trait-evaluation"

const empty = { says: [], thinks: [], does: [], feels: [] }

function withData(d: Partial<TraitEvaluationInput["empathyData"]>): TraitEvaluationInput {
  return { empathyData: { ...empty, ...d } }
}

describe("evaluateTraits — evidence gating", () => {
  it("returns nothing below the minimum evidence threshold", () => {
    expect(evaluateTraits(withData({ thinks: ["a", "b"] }))).toEqual([])
  })

  it("returns nothing for entirely empty input", () => {
    expect(evaluateTraits(withData({}))).toEqual([])
  })
})

describe("evaluateTraits — processing style", () => {
  it("identifies a thinking-dominant processing style", () => {
    const obs = evaluateTraits(
      withData({ thinks: ["a", "b", "c", "d", "e", "f"], feels: ["x", "y"] })
    )
    const ids = obs.map((o) => o.id)
    expect(ids).toContain("style-thinks")
    // head-before-heart should also fire (thinks >> feels)
    expect(ids).toContain("head-before-heart")
  })

  it("identifies a feeling-forward style", () => {
    const obs = evaluateTraits(
      withData({ feels: ["a", "b", "c", "d", "e"], says: ["x", "y", "z"] })
    )
    expect(obs.map((o) => o.id)).toContain("style-feels")
  })

  it("every observation carries a non-empty why", () => {
    const obs = evaluateTraits(
      withData({ thinks: ["a", "b", "c", "d", "e", "f"], feels: ["x", "y"] })
    )
    expect(obs.length).toBeGreaterThan(0)
    for (const o of obs) {
      expect(o.why.length).toBeGreaterThan(0)
      expect(o.text.length).toBeGreaterThan(0)
    }
  })
})

describe("evaluateTraits — somatic + self-criticism", () => {
  it("notices body awareness from repeated somatic references", () => {
    const obs = evaluateTraits(
      withData({
        feels: ["tightness in my chest", "a knot in my stomach", "felt heavy"],
        thinks: ["a", "b", "c", "d", "e"],
      })
    )
    expect(obs.map((o) => o.id)).toContain("somatic-aware")
  })

  it("flags a recurring self-critical note (descriptive, not clinical)", () => {
    const obs = evaluateTraits(
      withData({
        thinks: ["it's my fault", "I'm not good enough", "a", "b", "c"],
        feels: ["sad", "tired", "low"],
      })
    )
    const selfCrit = obs.find((o) => o.id === "self-critical")
    expect(selfCrit).toBeTruthy()
    // Must read as a gentle reflection, not a diagnosis/label.
    expect(selfCrit!.text.toLowerCase()).not.toMatch(/disorder|depress|anxiet|neurotic/)
  })
})

describe("evaluateTraits — trajectory", () => {
  it("notices opening up as depth rises over time", () => {
    const meta = [
      { depth: 1, primaryQuadrant: "SAYS" as const, sentimentPolarity: 0 },
      { depth: 2, primaryQuadrant: "SAYS" as const, sentimentPolarity: 0 },
      { depth: 2, primaryQuadrant: "THINKS" as const, sentimentPolarity: -0.2 },
      { depth: 5, primaryQuadrant: "FEELS" as const, sentimentPolarity: -0.3 },
      { depth: 6, primaryQuadrant: "FEELS" as const, sentimentPolarity: -0.4 },
      { depth: 7, primaryQuadrant: "FEELS" as const, sentimentPolarity: -0.5 },
    ]
    const obs = evaluateTraits({
      empathyData: { says: ["a", "b", "c"], thinks: ["d", "e"], does: ["f"], feels: ["g", "h"] },
      metaHistory: meta,
    })
    expect(obs.map((o) => o.id)).toContain("opens-with-trust")
  })
})
