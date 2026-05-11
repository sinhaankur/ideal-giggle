// Modality selector. Given the user's regulation state, conversation
// arc, and their inferred intent, picks which therapeutic frame the
// next response should sit in. Modalities exist because the same
// utterance from the user can warrant a totally different reply
// depending on whether they're regulated and exploring, vs.
// dysregulated and panicking, vs. consolidating insight.

import type {
  ArcPhase,
  PlanInput,
  RegulationState,
  TherapyModality,
} from "./types"

interface ModalityInput extends PlanInput {
  regulation: RegulationState
  arc: ArcPhase
}

export function selectModality(input: ModalityInput): TherapyModality {
  const { regulation, arc, understanding, wantsForwardMotion, reading } = input

  // Dorsal → presence only. No technique, just being there.
  if (regulation === "dorsal") return "presence"

  // Sympathetic → somatic always. Body first, story second.
  if (regulation === "sympathetic") return "somatic"

  // From here on we're in ventral — full toolbox available.

  // Closing → motivational interviewing's summarize move; affirm
  // what the user showed up with.
  if (arc === "closing") return "motivational"

  // Integrating → ACT — connect what we just named back to values
  // and forward motion.
  if (arc === "integrating") return "act"

  // Reframing → CBT — gentle work on the thought pattern that's
  // driving the feeling.
  if (arc === "reframing") return "cbt"

  // Solution-focused: user explicitly wants to move forward and is
  // regulated enough to actually plan something.
  if (wantsForwardMotion && understanding.primaryIntent === "problem-solving") {
    return "solution-focused"
  }

  // DBT shines in "I know but I can't" moments — when the user is
  // validating their own pain AND needs a skill.
  if (
    understanding.primaryIntent === "venting" &&
    understanding.emotionalLoad === "moderate" &&
    reading.arousal > 0.5
  ) {
    return "dbt"
  }

  // Motivational interviewing is the right default for ambivalence /
  // reflection / wanting-but-not-doing.
  if (understanding.primaryIntent === "reflection") return "motivational"

  // Everything else — Rogerian reflective listening. The safest
  // default; meets the person where they are without imposing a frame.
  return "rogerian"
}
