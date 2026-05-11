// Intent stack selector. Returns 1-3 ordered intents that describe what
// THIS reply is trying to do. The first intent dominates; later intents
// are optional supports. A response that hits its intents in order
// feels deliberate; a response that doesn't know its own intent reads
// as generic.
//
// Examples produced by the table below:
//   dorsal + opening               → [witness]
//   sympathetic + naming           → [validate, anchor]
//   ventral + reframing            → [reflect, reframe, clarify]
//   ventral + integrating          → [summarize, bridge, affirm]
//   ventral + closing              → [affirm, summarize]

import type {
  ArcPhase,
  PlanInput,
  RegulationState,
  ResponseIntent,
  TherapyModality,
} from "./types"

interface IntentInput extends PlanInput {
  regulation: RegulationState
  arc: ArcPhase
  modality: TherapyModality
}

export function selectIntents(input: IntentInput): ResponseIntent[] {
  const { regulation, arc, modality, recentlyCorrected, understanding } = input

  // Hard rule: if the user just corrected the Mirror, the next turn
  // leads with reflect — we got their read wrong and need to honestly
  // adjust before doing anything else.
  if (recentlyCorrected) return ["reflect", "validate"]

  // Dorsal: minimum-words witnessing. We don't pile on more questions
  // when someone is collapsed.
  if (regulation === "dorsal") {
    if (arc === "opening") return ["witness"]
    return ["witness", "validate"]
  }

  // Sympathetic: validate the affect, then anchor to body or present
  // moment. Never reframe or summarize a panicking person.
  if (regulation === "sympathetic") {
    return arc === "opening"
      ? ["validate", "anchor"]
      : ["validate", "anchor", "reflect"]
  }

  // From here on, ventral. The toolbox opens up.

  // Closing arc — wrap up with affirmation + summary.
  if (arc === "closing") {
    return ["affirm", "summarize"]
  }

  // Integrating — connect insight to identity / values, affirm
  // movement, gentle summary.
  if (arc === "integrating") {
    return ["summarize", "bridge", "affirm"]
  }

  // Reframing — gentle CBT move: reflect first to keep grounded, offer
  // the reframe second, clarify whether it landed.
  if (arc === "reframing") {
    return ["reflect", "reframe", "clarify"]
  }

  // Modality-specific intent stacks for naming / exploring phases.
  if (modality === "somatic") return ["anchor", "validate"]
  if (modality === "solution-focused") return ["clarify", "mobilize"]
  if (modality === "dbt") return ["validate", "reflect", "mobilize"]
  if (modality === "act") return ["reflect", "bridge"]
  if (modality === "cbt") return ["reflect", "reframe"]
  if (modality === "motivational") return ["reflect", "clarify"]

  // Default Rogerian shape — reflect, then clarify if curiosity is invited.
  if (understanding.openness === "low") return ["witness", "reflect"]
  if (understanding.openness === "high") return ["reflect", "clarify"]
  return ["reflect", "validate", "clarify"]
}
