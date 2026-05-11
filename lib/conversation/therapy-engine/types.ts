// Therapy engine types — the shape of a ResponsePlan, the structured
// decision the engine emits for each turn. Everything else in the
// therapy-engine/ module either produces one of these fields or
// consumes the plan to compose a reply.
//
// The frameworks referenced here are real clinical / counseling
// taxonomies, not internal abstractions:
//   - Polyvagal theory (Porges, 1995) — ventral / sympathetic / dorsal
//   - Conversation arc — Rogers' phases + standard counseling structure
//   - OARS — Miller & Rollnick, Motivational Interviewing
//   - CBT / DBT / ACT / solution-focused — modality choices the engine
//     selects from based on the user's current regulation + intent.

import type { EmotionalReading } from "../emotion-engine"
import type { UserUnderstanding } from "../communication-engine"

// ---------------------------------------------------------------------------
// Autonomic regulation state (polyvagal).
// ---------------------------------------------------------------------------
// ventral:     socially engaged, safe enough for reflection / insight work
// sympathetic: mobilized — fight/flight/anxiety/anger
// dorsal:      immobilized — shutdown / numb / despair / hopelessness
// The engine refuses to do insight or problem-solving when sympathetic
// or dorsal — those states need regulation first.
export type RegulationState = "ventral" | "sympathetic" | "dorsal"

// ---------------------------------------------------------------------------
// Conversation arc phase.
// ---------------------------------------------------------------------------
// opening:      first few turns — establish rapport, lower stakes
// exploring:    user is sharing, engine is curious and reflective
// naming:       a specific feeling / pattern is coming into focus
// reframing:    user is ready (or has been gently offered) a new angle
// integrating:  user is connecting insight back to identity / values
// closing:      bringing the session to a soft landing
export type ArcPhase =
  | "opening"
  | "exploring"
  | "naming"
  | "reframing"
  | "integrating"
  | "closing"

// ---------------------------------------------------------------------------
// Therapeutic modality.
// ---------------------------------------------------------------------------
export type TherapyModality =
  | "presence"          // just be present — silence-leaning
  | "rogerian"          // reflective listening, unconditional positive regard
  | "motivational"      // OARS: open Q / affirm / reflect / summarize
  | "cbt"               // cognitive reframing — gently name the thought
  | "dbt"               // dialectical — validate AND offer a skill
  | "act"               // acceptance + values-based forward motion
  | "somatic"           // body-based grounding, breath, sensory
  | "solution-focused"  // narrow to the next concrete step

// ---------------------------------------------------------------------------
// Response intent ladder.
// ---------------------------------------------------------------------------
// Each turn picks 1-3 intents; their ORDER matters (the first is the
// dominant move). Ordered roughly from "do less / hold space" at the
// top to "actively move" at the bottom.
export type ResponseIntent =
  | "witness"     // present, no question, sometimes just "Mm."
  | "validate"    // name the legitimacy of the feeling
  | "reflect"     // mirror understanding back literally
  | "clarify"     // gentle probe for a specific detail
  | "anchor"      // bring attention to body / present moment
  | "reframe"     // offer a slightly different angle (gently)
  | "affirm"      // highlight a strength the user already showed
  | "bridge"      // connect to values or identity
  | "mobilize"    // offer one small concrete next step
  | "summarize"   // consolidate what's been said

// ---------------------------------------------------------------------------
// Dose — how much to say this turn.
// ---------------------------------------------------------------------------
// Real therapists vary their bandwidth. Heavy load + low regulation
// gets micro (sometimes a single word). Ventral exploration gets
// standard. Late integrating can earn a longer summary.
export type ResponseDose = "micro" | "short" | "standard" | "long"

export const DOSE_TOKEN_BUDGET: Record<ResponseDose, number> = {
  micro: 30,
  short: 80,
  standard: 200,
  long: 400,
}

// ---------------------------------------------------------------------------
// Pacing register — match the user's energy, hold space, or lift forward.
// ---------------------------------------------------------------------------
// hold:  slow it down, less words, more space
// match: same energy as the user — neither pull forward nor hold back
// lift:  gentle forward motion toward integration / next step
export type PacingRegister = "hold" | "match" | "lift"

// ---------------------------------------------------------------------------
// The full ResponsePlan.
// ---------------------------------------------------------------------------
export interface ResponsePlan {
  regulation: RegulationState
  arc: ArcPhase
  modality: TherapyModality
  intents: ResponseIntent[]
  dose: ResponseDose
  pacing: PacingRegister
  // Hard rules for this turn — things the response MUST avoid.
  forbidden: string[]
  // Must the reply quote the user's words back? Almost always yes; this
  // makes it explicit so the composer / system prompt enforces it.
  mustQuoteUser: boolean
  // Should the reply end on a question? Sometimes (sympathetic load,
  // dorsal state, holding) the answer is no.
  mustAskQuestion: boolean
  // Body anchors detected in the user's input — the reply should
  // acknowledge at least one if present.
  bodyAnchors: string[]
  // Free-text trace: a short human-readable explanation of why this
  // plan was chosen. Useful for transparency / Mirror display /
  // debugging. Not for direct user consumption.
  reasoning: string
}

// ---------------------------------------------------------------------------
// Input shape for planTherapyResponse — everything the engine needs to
// pick a plan. The caller is responsible for assembling this from the
// conversation state.
// ---------------------------------------------------------------------------
export interface PlanInput {
  // Current felt-state reading from the emotion engine.
  reading: EmotionalReading
  // Inferred user-utterance properties from the communication engine.
  understanding: UserUnderstanding
  // Total user-side messages so far this session.
  userTurnCount: number
  // Elapsed minutes since session started.
  sessionMinutes: number
  // Conversation history — recent valence trajectory + matched-token
  // counts let the engine detect rumination loops or rising-then-falling
  // arousal patterns. Keep small; the caller only needs to pass the
  // last ~8 readings.
  recentReadings?: Array<{ valence: number; arousal: number }>
  // Has the user signaled they want a concrete next step (problem-solving)?
  wantsForwardMotion?: boolean
  // Has the user just corrected the Mirror? If so, bias toward MORE
  // careful reflection on this turn — the previous read was wrong.
  recentlyCorrected?: boolean
  // The user's preferred name (for soft affirmations) — optional.
  preferredName?: string
}
