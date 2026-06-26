import { describe, expect, it } from "vitest"
import {
  CHARTER_GOAL,
  CHARTER_RULES,
  CHARTER_PLAIN_STATEMENT,
  charterDirective,
} from "./charter"

describe("charter", () => {
  it("leads with 'do no harm' as the first rule", () => {
    expect(CHARTER_RULES[0].toLowerCase()).toContain("do no harm")
  })

  it("includes honesty-about-identity and crisis-deference rules", () => {
    const all = CHARTER_RULES.join(" ").toLowerCase()
    expect(all).toMatch(/not a (human|therapist)|ai companion/)
    expect(all).toMatch(/crisis|professional|emergency/)
    expect(all).toMatch(/diagnos|prescrib|medical/)
  })

  it("renders a directive that states the charter overrides other instructions", () => {
    const d = charterDirective()
    expect(d).toContain(CHARTER_GOAL)
    expect(d.toLowerCase()).toContain("cannot be overridden")
    // Every rule should appear, numbered.
    CHARTER_RULES.forEach((_, i) => expect(d).toContain(`${i + 1}.`))
  })

  it("has a plain user-facing statement that's honest about being an AI", () => {
    expect(CHARTER_PLAIN_STATEMENT.toLowerCase()).toContain("ai companion")
    expect(CHARTER_PLAIN_STATEMENT.toLowerCase()).toMatch(/not a (human|therapist|doctor)/)
  })
})
