// Dose + pacing calibrator.
//
// Dose answers "how much should I say this turn?" — and the honest
// answer is usually less than the model wants to say. Heavy load gets
// fewer words. The "light level" the user asked for lives here: micro
// dose + hold pacing = a one-line acknowledgement; standard dose +
// match pacing = the bulk of a working session; long dose + lift
// pacing = a summary at integration time.
//
// Pacing answers "where am I taking the energy?" — hold it, match it,
// or lift it gently forward.

import type {
  ArcPhase,
  PacingRegister,
  PlanInput,
  RegulationState,
  ResponseDose,
  ResponseIntent,
} from "./types"

interface DoseInput extends PlanInput {
  regulation: RegulationState
  arc: ArcPhase
  intents: ResponseIntent[]
}

export function selectDose(input: DoseInput): ResponseDose {
  const { regulation, arc, intents, understanding } = input

  // Dorsal: micro. Real therapists know that "Mm." and a held breath
  // do more for a shut-down person than three sentences ever will.
  if (regulation === "dorsal") return "micro"

  // Sympathetic: short. Enough to validate and anchor; not enough to
  // overwhelm an already-flooded nervous system.
  if (regulation === "sympathetic") return "short"

  // Witness-only intents are by definition micro.
  if (intents.length === 1 && intents[0] === "witness") return "micro"

  // Closing or integrating earn a longer summary.
  if (arc === "closing") return "standard"
  if (arc === "integrating" && intents.includes("summarize")) return "long"

  // Low-openness user signals "less, please." Honor it.
  if (understanding.openness === "low") return "short"

  // Default working register.
  return "standard"
}

export function selectPacing(input: DoseInput): PacingRegister {
  const { regulation, arc, recentReadings = [] } = input

  // Dorsal: hold space. The energy is depleted; we don't pull or push.
  if (regulation === "dorsal") return "hold"

  // Sympathetic: hold. Anything else risks intensifying the activation.
  if (regulation === "sympathetic") return "hold"

  // Closing or integrating: lift. The arc has earned forward motion.
  if (arc === "closing" || arc === "integrating") return "lift"

  // Reframing: lift gently — that's the whole point of a reframe.
  if (arc === "reframing") return "lift"

  // If recent trajectory shows arousal climbing, match (don't lift —
  // that would crowd the user; don't hold — we'd disengage). Just
  // stay alongside.
  if (recentReadings.length >= 2) {
    const last = recentReadings[recentReadings.length - 1]
    const prev = recentReadings[recentReadings.length - 2]
    if (last.arousal - prev.arousal > 0.15) return "match"
  }

  // Default exploration: match.
  return "match"
}
