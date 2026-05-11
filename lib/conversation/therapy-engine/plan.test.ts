import { describe, expect, it } from "vitest"
import { analyzeEmotion } from "../emotion-engine"
import { inferUserUnderstanding } from "../communication-engine"
import { planTherapyResponse } from "./plan"
import { composeFromPlan } from "./compose"
import { directivesFromPlan } from "./directives"
import type { PlanInput } from "./types"

function buildInput(
  text: string,
  overrides?: Partial<PlanInput>
): PlanInput {
  const reading = analyzeEmotion(text)
  const understanding = inferUserUnderstanding(text)
  return {
    reading,
    understanding,
    userTurnCount: 5,
    sessionMinutes: 5,
    recentReadings: [],
    ...overrides,
  }
}

describe("planTherapyResponse — regulation routing", () => {
  it("classifies a panicking user as sympathetic and refuses to reframe", () => {
    const plan = planTherapyResponse(
      buildInput("I'm panicking and my chest is so tight I can't breathe")
    )
    expect(plan.regulation).toBe("sympathetic")
    expect(plan.intents[0]).toBe("validate")
    expect(plan.intents).toContain("anchor")
    expect(plan.forbidden.some((f) => /reframe/i.test(f))).toBe(true)
    expect(plan.dose).toBe("short")
  })

  it("classifies dorsal collapse and returns witness-only intent", () => {
    const plan = planTherapyResponse(
      buildInput("I'm so numb. Nothing matters. I don't care anymore.")
    )
    expect(plan.regulation).toBe("dorsal")
    expect(plan.intents[0]).toBe("witness")
    expect(plan.dose).toBe("micro")
    expect(plan.mustAskQuestion).toBe(false)
  })

  it("classifies a regulated exploring user as ventral", () => {
    const plan = planTherapyResponse(
      buildInput(
        "I've been thinking about what happened at work, and I'm trying to figure out my part in it.",
        { userTurnCount: 6, sessionMinutes: 8 }
      )
    )
    expect(plan.regulation).toBe("ventral")
    expect(plan.arc === "exploring" || plan.arc === "naming" || plan.arc === "reframing").toBe(true)
  })
})

describe("planTherapyResponse — arc detection", () => {
  it("treats the first few turns as opening", () => {
    const plan = planTherapyResponse(
      buildInput("Hi, I want to talk about my day.", { userTurnCount: 1, sessionMinutes: 0.5 })
    )
    expect(plan.arc).toBe("opening")
  })

  it("moves to integrating when arousal drops and valence lifts", () => {
    const plan = planTherapyResponse(
      buildInput("I think I see it now. I was scared of being unseen.", {
        userTurnCount: 12,
        sessionMinutes: 12,
        recentReadings: [
          { valence: -0.8, arousal: 0.9 },
          { valence: -0.4, arousal: 0.6 },
          { valence: 0.1, arousal: 0.4 },
        ],
      })
    )
    expect(plan.arc).toBe("integrating")
    expect(plan.pacing).toBe("lift")
  })

  it("moves to closing for long ventral sessions", () => {
    const plan = planTherapyResponse(
      buildInput("Yeah I think that's where I'll land for tonight.", {
        userTurnCount: 24,
        sessionMinutes: 28,
        recentReadings: [
          { valence: 0.2, arousal: 0.3 },
          { valence: 0.3, arousal: 0.3 },
        ],
      })
    )
    expect(plan.arc).toBe("closing")
    expect(plan.intents).toContain("affirm")
  })
})

describe("planTherapyResponse — forbidden moves", () => {
  it("forbids advice when sympathetic", () => {
    const plan = planTherapyResponse(buildInput("I'm spiraling and I can't think straight"))
    expect(plan.regulation).toBe("sympathetic")
    expect(plan.forbidden.join(" | ")).toMatch(/advice|next steps/i)
  })

  it("forbids reframing when dorsal", () => {
    const plan = planTherapyResponse(buildInput("Empty. Nothing matters anymore."))
    expect(plan.regulation).toBe("dorsal")
    expect(plan.forbidden.join(" | ")).toMatch(/reframe/i)
  })
})

describe("planTherapyResponse — correction handling", () => {
  it("when the Mirror was just corrected, the next reply leads with reflect", () => {
    const plan = planTherapyResponse(
      buildInput("I was scared, not angry", { recentlyCorrected: true })
    )
    expect(plan.intents[0]).toBe("reflect")
  })
})

describe("composeFromPlan", () => {
  it("returns a micro response when the plan is witness-only", () => {
    const plan = planTherapyResponse(buildInput("Empty. Nothing matters."))
    const composed = composeFromPlan(plan, "Empty. Nothing matters.", 1)
    expect(composed.length).toBeGreaterThan(0)
    expect(composed.length).toBeLessThan(40)
  })

  it("anchors to body when body anchors are present", () => {
    const plan = planTherapyResponse(
      buildInput("My chest is so tight I can't breathe and I'm panicking")
    )
    const composed = composeFromPlan(
      plan,
      "My chest is so tight I can't breathe and I'm panicking",
      1
    )
    expect(composed.length).toBeGreaterThan(0)
    expect(composed.toLowerCase()).toMatch(/breath|exhale|chest|slow/i)
  })
})

describe("directivesFromPlan", () => {
  it("renders a per-turn directive block with state, dose, and forbidden moves", () => {
    const plan = planTherapyResponse(
      buildInput("My heart is racing and I'm spiraling")
    )
    const directive = directivesFromPlan(plan)
    expect(directive).toMatch(/sympathetic/i)
    expect(directive).toMatch(/dose|length/i)
    expect(directive).toMatch(/forbidden/i)
    expect(directive).toMatch(/anchor/i)
  })
})
