import { describe, expect, it } from "vitest"
import {
  SESSION_INTENTIONS,
  getSessionIntention,
  sessionIntentionDirective,
} from "./session-intention"

describe("session intention", () => {
  it("exposes a stable set of options with required fields", () => {
    expect(SESSION_INTENTIONS.length).toBeGreaterThanOrEqual(5)
    for (const opt of SESSION_INTENTIONS) {
      expect(opt.id).toBeTruthy()
      expect(opt.label).toBeTruthy()
      expect(opt.prompt).toMatch(/^I want|^I just want/)
      expect(opt.directive.length).toBeGreaterThan(20)
    }
  })

  it("resolves a known id to its option", () => {
    expect(getSessionIntention("calmer")?.label).toBe("Calmer")
    expect(getSessionIntention("heard")?.id).toBe("heard")
  })

  it("returns null for unknown or empty ids", () => {
    expect(getSessionIntention(null)).toBeNull()
    expect(getSessionIntention(undefined)).toBeNull()
    // @ts-expect-error - intentionally passing an invalid id
    expect(getSessionIntention("nonsense")).toBeNull()
  })

  it("builds a directive that names the intention and includes its steering", () => {
    const directive = sessionIntentionDirective("heard")
    expect(directive).toContain("just want to be heard")
    expect(directive.toLowerCase()).toMatch(/not fixed|presence|listening|hear/)
  })

  it("returns an empty directive when no intention is set", () => {
    expect(sessionIntentionDirective(null)).toBe("")
    expect(sessionIntentionDirective(undefined)).toBe("")
  })
})
