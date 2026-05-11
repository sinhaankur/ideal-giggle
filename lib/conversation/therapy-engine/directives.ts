// Translates a ResponsePlan into a concise, model-readable directive
// block. The block goes into the system prompt for this turn so the
// LLM has explicit, per-turn instructions — "right now: validate then
// anchor, micro dose, hold pacing, do not ask multiple questions."
//
// The block is a tight specification, not prose. The model reads it
// best when each rule is on its own line and starts with a verb.

import { DOSE_TOKEN_BUDGET, type ResponseDose, type ResponsePlan } from "./types"

const DOSE_HINT: Record<ResponseDose, string> = {
  micro: "One sentence at most. Often two or three words is enough.",
  short: "One short sentence; at most two.",
  standard: "Two to four sentences total.",
  long: "A short paragraph — three to five sentences — for synthesis.",
}

const INTENT_GUIDANCE: Record<string, string> = {
  witness:
    "Just be present. Use a minimal acknowledgement. No analysis, no question.",
  validate:
    "Name the legitimacy of what they're feeling without softening or fixing.",
  reflect:
    "Mirror back what you heard using their literal words — quote 3-7 of them.",
  clarify:
    "Ask exactly one concrete, answerable question about a specific detail.",
  anchor:
    "Bring attention to the body or the present moment. Reference a body anchor if one was named.",
  reframe:
    "Offer a gentle alternative angle as a possibility, not a conclusion. Frame it as a question or 'I wonder if...'",
  affirm:
    "Name a real strength the user just showed — be specific, not generic.",
  bridge:
    "Connect what they just said to values, identity, or what matters to them.",
  mobilize:
    "Offer ONE tiny concrete next step. Make it almost embarrassingly small.",
  summarize:
    "Consolidate the thread of the conversation in 2-3 sentences. Use their own words where possible.",
}

const REGULATION_FRAME: Record<ResponsePlan["regulation"], string> = {
  ventral:
    "User is regulated enough for reflection / insight / forward motion.",
  sympathetic:
    "User is in sympathetic activation (mobilized — anxious, panicking, angry). Body first. Words slow.",
  dorsal:
    "User is in dorsal shutdown (depleted, numb, hopeless). Presence only. Almost no words.",
}

const ARC_FRAME: Record<ResponsePlan["arc"], string> = {
  opening: "Early in the conversation — keep it warm and low-pressure.",
  exploring: "Mid-session exploration — stay curious, follow what the user opens.",
  naming: "A specific feeling is coming into focus — help name it precisely.",
  reframing: "A reframe is appropriate — offer it as a question, not a verdict.",
  integrating: "User is integrating insight — connect back to identity / values.",
  closing: "Session is winding down — affirm what was shown up with, and land softly.",
}

const PACING_FRAME: Record<ResponsePlan["pacing"], string> = {
  hold: "Hold space. Slow the pace. Less is more.",
  match: "Match the user's current energy — neither pull forward nor hold back.",
  lift: "Gently lift toward forward motion or integration.",
}

const MODALITY_FRAME: Record<ResponsePlan["modality"], string> = {
  presence: "Be present. No technique. No question.",
  rogerian: "Reflective listening — accurate empathy + unconditional positive regard.",
  motivational: "OARS frame: open questions, affirmations, reflections, summaries.",
  cbt: "Gently surface the thought driving the feeling. Question, don't lecture.",
  dbt: "Validate AND offer one skill. Both, never just one.",
  act: "Acceptance + values. What matters to them here?",
  somatic: "Body first. Breath, sensation, posture, present moment.",
  "solution-focused": "Narrow to one tiny next step. No long analysis.",
}

export function directivesFromPlan(plan: ResponsePlan, preferredName?: string): string {
  const lines: string[] = []

  lines.push("THIS TURN'S DIRECTIVE — follow these before any general guidelines:")
  lines.push("")
  lines.push(`State: ${REGULATION_FRAME[plan.regulation]}`)
  lines.push(`Arc: ${ARC_FRAME[plan.arc]}`)
  lines.push(`Modality: ${MODALITY_FRAME[plan.modality]}`)
  lines.push(`Pacing: ${PACING_FRAME[plan.pacing]}`)
  lines.push(`Length: ${DOSE_HINT[plan.dose]} (budget ~${DOSE_TOKEN_BUDGET[plan.dose]} tokens)`)
  lines.push("")
  lines.push("Intent stack (lead with the first; the rest are secondary supports):")
  plan.intents.forEach((intent, i) => {
    lines.push(`  ${i + 1}. ${intent.toUpperCase()} — ${INTENT_GUIDANCE[intent] ?? intent}`)
  })
  lines.push("")

  if (plan.mustQuoteUser) {
    lines.push("REQUIRED: quote 3-7 of the user's exact words back to them.")
  }

  if (plan.bodyAnchors.length > 0) {
    lines.push(
      `Body anchors the user named: ${plan.bodyAnchors.join(", ")}. Acknowledge at least one.`
    )
  }

  if (!plan.mustAskQuestion) {
    lines.push("REQUIRED: do NOT end on a question this turn.")
  } else {
    lines.push("End with one specific, answerable question grounded in what they just said.")
  }

  if (plan.forbidden.length > 0) {
    lines.push("")
    lines.push("Forbidden moves this turn:")
    for (const rule of plan.forbidden) {
      lines.push(`  - ${rule}`)
    }
  }

  if (preferredName) {
    lines.push("")
    lines.push(`User's preferred name is ${preferredName}. Use it sparingly — once is plenty per turn.`)
  }

  return lines.join("\n")
}
