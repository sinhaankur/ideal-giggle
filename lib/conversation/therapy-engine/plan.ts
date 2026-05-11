// Top-level orchestrator: takes the raw PlanInput and produces a fully
// resolved ResponsePlan. All decisions are deterministic so the same
// input always produces the same plan — easy to reason about and test.
//
// The classifiers run in order because each depends on the previous:
//   regulation → arc → modality → intents → dose → pacing → forbidden

import type { PlanInput, ResponsePlan } from "./types"
import { classifyRegulation } from "./regulation"
import { classifyArc } from "./arc"
import { selectModality } from "./modality"
import { selectIntents } from "./intent"
import { selectDose, selectPacing } from "./dose"

// Per-state explicit forbid lists. These ride on the system prompt to
// the LLM and are checked by the local composer. The whole point is
// to keep the model from doing damaging well-meant moves like
// "let's reframe this" to someone who's panicking.
function buildForbidden(plan: Omit<ResponsePlan, "forbidden">): string[] {
  const out: Set<string> = new Set()

  if (plan.regulation === "dorsal") {
    out.add("Do not ask multiple questions; ask zero or one.")
    out.add("Do not offer advice, fixes, or solutions.")
    out.add("Do not reframe — the cognitive system is offline right now.")
    out.add("Do not summarize or analyze.")
    out.add("Do not say 'you're not alone' as a closer — it can feel dismissive.")
  }

  if (plan.regulation === "sympathetic") {
    out.add("Do not reframe — the user is dysregulated; reframes will feel like dismissal.")
    out.add("Do not summarize what they're feeling — they already know.")
    out.add("Do not offer advice or next steps until the body has settled.")
    out.add("Do not ask 'why' — it pulls them into analysis mid-flood.")
  }

  if (plan.regulation === "ventral") {
    // Even in ventral we keep some hard rules.
    out.add("Do not use generic openers like 'That sounds...' or 'Thank you for sharing.'")
  }

  if (plan.intents[0] === "witness") {
    out.add("Do not end on a question.")
    out.add("Keep the entire reply under 15 words.")
  }

  if (plan.dose === "micro") {
    out.add("Total reply length is at most one short sentence.")
  }

  if (plan.arc === "opening") {
    out.add("Do not go deep yet — let the user choose the depth.")
  }

  if (plan.modality === "presence") {
    out.add("Do not introduce any technique or skill.")
  }

  if (plan.modality === "somatic") {
    out.add("Do not move into analysis until breath / body has been acknowledged.")
  }

  return Array.from(out)
}

function buildReasoning(plan: Omit<ResponsePlan, "reasoning">): string {
  return [
    `regulation=${plan.regulation}`,
    `arc=${plan.arc}`,
    `modality=${plan.modality}`,
    `intents=[${plan.intents.join(", ")}]`,
    `dose=${plan.dose}`,
    `pacing=${plan.pacing}`,
  ].join(" · ")
}

export function planTherapyResponse(input: PlanInput): ResponsePlan {
  const regulation = classifyRegulation(input)
  const arc = classifyArc({ ...input, regulation })
  const modality = selectModality({ ...input, regulation, arc })
  const intents = selectIntents({ ...input, regulation, arc, modality })
  const dose = selectDose({ ...input, regulation, arc, intents })
  const pacing = selectPacing({ ...input, regulation, arc, intents })

  // Question-asking is forbidden when witnessing; otherwise it's the
  // default, BUT we never ask a question when the user is in dorsal
  // and we're not at all sure they have the bandwidth.
  const mustAskQuestion =
    intents[0] !== "witness" && regulation !== "dorsal" && intents[0] !== "summarize"

  // Mirroring the user's literal words is the engine's hard rule.
  // It's almost always true; we only drop it for pure witnessing
  // moments where even quoting them feels like too many words.
  const mustQuoteUser = !(intents[0] === "witness" && dose === "micro")

  const partial: Omit<ResponsePlan, "forbidden" | "reasoning"> = {
    regulation,
    arc,
    modality,
    intents,
    dose,
    pacing,
    mustQuoteUser,
    mustAskQuestion,
    bodyAnchors: input.reading.bodyAnchors,
  }

  const forbidden = buildForbidden(partial as Omit<ResponsePlan, "forbidden">)
  const reasoning = buildReasoning({ ...partial, forbidden } as Omit<ResponsePlan, "reasoning">)

  return { ...partial, forbidden, reasoning }
}
