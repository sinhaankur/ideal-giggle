// Polyvagal-style regulation classifier.
//
// Maps the user's current emotion + body signals onto three autonomic
// states. The engine refuses to do certain things (deep questions,
// reframes, advice) when the user is in sympathetic or dorsal — those
// states need nervous-system settling first. Reflexes:
//
//   ventral:     reflect, clarify, reframe — full toolbox
//   sympathetic: validate + anchor; absolutely no reframes / advice
//   dorsal:      witness only; sometimes just "Mm." and a held space
//
// Reference: Porges, S. W. (2011). The Polyvagal Theory.

import type { PlanInput, RegulationState } from "./types"

// Words that strongly signal dorsal collapse — beyond what the Plutchik
// engine catches as sadness/high. These are flat, depleted, numb
// patterns where standard "tell me more" responses are damaging.
const DORSAL_PATTERNS = [
  /\b(numb|empty|hollow|nothing matters|whatever|i don'?t care|don'?t want to|cant move|can'?t move|frozen|gave up|over it|why bother|pointless|what'?s the point)\b/i,
  /\b(too tired|too exhausted|cant be bothered|can'?t be bothered)\b/i,
  /\b(no energy|drained|spent|done with everything|done with life|empty inside)\b/i,
]

// Patterns that fast-track to sympathetic: mobilized panic / rage / spiral.
const SYMPATHETIC_PATTERNS = [
  /\b(spiraling|spiralling|panicking|panic attack|cant breathe|can'?t breathe|losing it|freaking out|raging|seething|about to explode|losing my mind)\b/i,
  /\b(heart racing|heart pounding|chest tight|shaking|trembling|hyperventilating)\b/i,
]

export function classifyRegulation(input: PlanInput): RegulationState {
  const { reading, understanding, recentReadings = [] } = input
  const textHits = (reading.matchedTokens || []).map((t) => t.token).join(" ")

  // Hard signals first — explicit dorsal language overrides arousal math.
  if (DORSAL_PATTERNS.some((p) => p.test(textHits))) {
    return "dorsal"
  }
  if (SYMPATHETIC_PATTERNS.some((p) => p.test(textHits))) {
    return "sympathetic"
  }

  // Body anchors that scream sympathetic.
  if (
    reading.bodyAnchors.includes("shallow breath") ||
    reading.bodyAnchors.includes("racing heart") ||
    reading.bodyAnchors.includes("shaking")
  ) {
    return "sympathetic"
  }

  // Arousal / valence math.
  //
  // sympathetic = high arousal AND negative valence
  //   (high arousal + positive valence is excitement, not dysregulation)
  // dorsal      = low arousal AND deep negative valence — the energy is
  //   gone and the affect is heavy
  // ventral     = anything else
  if (reading.arousal > 0.7 && reading.valence < -0.3) {
    return "sympathetic"
  }
  if (reading.arousal < 0.35 && reading.valence < -0.55) {
    return "dorsal"
  }

  // Trajectory check: if the last 3 readings have been low arousal +
  // negative valence with no movement, slide toward dorsal even if
  // this single reading wouldn't trigger.
  if (recentReadings.length >= 3) {
    const tail = recentReadings.slice(-3)
    const allFlat = tail.every((r) => r.arousal < 0.4 && r.valence < -0.4)
    if (allFlat) return "dorsal"
  }

  // Fall-through: high emotional load from the user-understanding
  // module (DISTRESS_PATTERN matched) without a regulation-specific
  // body signal — call it sympathetic.
  if (understanding.emotionalLoad === "high" && reading.valence < 0) {
    return "sympathetic"
  }

  return "ventral"
}
