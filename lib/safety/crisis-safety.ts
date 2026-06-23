// ---------------------------------------------------------------------------
// Crisis safety layer.
//
// This is the one place in EMPATHEIA that must NOT defer to the language model.
// When a person signals they may be in danger — of suicide, self-harm, or
// harming someone else — the right response is too important to leave to a
// probabilistic model that might miss it, soften it, or hallucinate a wrong
// resource. So we detect deterministically and return a fixed, warm,
// resource-bearing response that the app shows directly.
//
// Design principles ("do not let humans take a wrong step"):
//   1. Err toward catching. A false positive (offering help to someone who
//      was fine) costs a moment of gentleness. A false negative can cost a
//      life. The thresholds reflect that asymmetry.
//   2. Never diagnose, never judge, never argue. Validate, stay, and point to
//      a human who can help in real time.
//   3. Always include a concrete, real way to reach a person — not "seek
//      help" but an actual number/line.
//   4. Keep the door open. The companion stays present; it does not eject the
//      user or end the conversation.
// ---------------------------------------------------------------------------

export type CrisisKind = "suicide" | "self-harm" | "harm-other" | "distress" | null

// Severity tiers, lowest to highest:
//   "none"    — ordinary message, no safety handling.
//   "concern" — soft signals of hopelessness/giving-up. We gently check in and
//               keep the door open, WITHOUT hijacking the conversation with
//               hotline numbers. The model still drives the actual reply; this
//               is a nudge, not a pre-empt.
//   "crisis"  — explicit danger to self or others. Hard pre-empt, fixed
//               resource-bearing response, model never in the loop.
export type CrisisSeverity = "none" | "concern" | "crisis"

export interface CrisisAssessment {
  flagged: boolean
  // True only for the "crisis" tier — preserved for existing callers that
  // gate the hard pre-empt on `flagged`. "concern" is flagged: false.
  severity: CrisisSeverity
  kind: CrisisKind
  // The exact text to show the user. Guaranteed safe and resource-bearing for
  // the crisis tier. Empty string when severity is "none".
  response: string
  // For the "concern" tier: a short, optional steering note the caller can
  // fold into the model's guidance so the reply leans gently toward checking
  // in. Never shown to the user directly. Empty otherwise.
  guidance: string
}

// Phrases that strongly indicate suicidal ideation or intent. Word-boundary
// matched, case-insensitive. Kept explicit and readable on purpose — this
// list is a safety artifact and should be easy to audit and extend.
const SUICIDE_PHRASES = [
  "kill myself",
  "killing myself",
  "end my life",
  "ending my life",
  "end it all",
  "take my own life",
  "want to die",
  "wanna die",
  "want to be dead",
  "better off dead",
  "better off without me",
  "no reason to live",
  "nothing to live for",
  "don't want to be here anymore",
  "dont want to be here anymore",
  "can't go on",
  "cant go on",
  "not worth living",
  "suicidal",
  "suicide",
  "kms",
]

const SELF_HARM_PHRASES = [
  "hurt myself",
  "harm myself",
  "cut myself",
  "cutting myself",
  "self harm",
  "self-harm",
  "punish myself",
  "make myself bleed",
]

const HARM_OTHER_PHRASES = [
  "kill them",
  "kill him",
  "kill her",
  "hurt someone",
  "hurt them",
  "want to hurt",
  "going to hurt",
  "make them pay",
]

// Softer signals — hopelessness, giving up, feeling like a burden — that don't
// name a method or intent but deserve a gentler, attentive response. These do
// NOT trigger the hard pre-empt; they raise a "concern" the model is nudged to
// answer with extra care. Kept conservative to avoid pestering every sad
// message with a check-in.
const CONCERN_PHRASES = [
  "what's the point",
  "whats the point",
  "no point anymore",
  "pointless",
  "give up",
  "giving up",
  "can't do this anymore",
  "cant do this anymore",
  "so done with everything",
  "done with all of this",
  "tired of living",
  "tired of being alive",
  "hate my life",
  "hate myself",
  "burden to everyone",
  "burden on everyone",
  "everyone would be fine without me",
  "nobody would miss me",
  "i'm worthless",
  "im worthless",
  "empty inside",
  "numb to everything",
]

function containsPhrase(haystack: string, phrases: string[]): boolean {
  for (const phrase of phrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    // Loose boundaries: allow punctuation/space on either side. We intentionally
    // do NOT require whole-word isolation beyond edges so contractions and
    // trailing punctuation ("I want to die.") still match.
    const re = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i")
    if (re.test(haystack)) return true
  }
  return false
}

// Structured, real, free, confidential crisis resources. Exported so UI
// surfaces (e.g. an always-available Support panel) render the same vetted
// lines the conversational safety layer uses — single source of truth.
export interface CrisisResource {
  region: string
  text: string
  // tel:/sms:/mailto:/https: link when one applies, for click-to-act on mobile.
  href?: string
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    region: "US & Canada",
    text: "Call or text 988 (Suicide & Crisis Lifeline), 24/7.",
    href: "tel:988",
  },
  {
    region: "UK & Ireland",
    text: "Call Samaritans on 116 123, or email jo@samaritans.org.",
    href: "tel:116123",
  },
  {
    region: "Anywhere else",
    text: "findahelpline.com lists free, confidential lines for your country.",
    href: "https://findahelpline.com",
  },
  {
    region: "Immediate danger",
    text: "If you might act on this very soon, please treat it as an emergency — your local emergency number or nearest ER.",
  },
]

// Shared resource block — real, free, confidential lines. International by
// design so the response is useful regardless of where the person is.
const RESOURCES = CRISIS_RESOURCES.map((r) => `• ${r.region}: ${r.text}`).join("\n")

function suicideResponse(): string {
  return [
    "I want to stop and be fully here with you, because what you just said matters to me.",
    "It sounds like you're in real pain right now — more than anyone should carry alone. I'm not going anywhere.",
    "I'm an AI, though, and when it's about your safety you deserve a real person who can be with you in this moment:",
    RESOURCES,
    "If you're willing, stay here and tell me what today has been like. You don't have to hold this by yourself.",
  ].join("\n\n")
}

function selfHarmResponse(): string {
  return [
    "Thank you for telling me that — it takes a lot, and I'm taking it seriously.",
    "When the urge to hurt yourself is this strong, please reach a person who can stay with you right now:",
    RESOURCES,
    "I'm still right here too. Can you tell me what's making the pain feel this loud today?",
  ].join("\n\n")
}

function harmOtherResponse(): string {
  return [
    "I can hear how much rage and pain is in this. I'm staying with you.",
    "If you're worried you might actually hurt someone, the safest thing is to talk to a person who can help you hold this before anything happens:",
    RESOURCES,
    "Right now, with me: what happened that brought you to this edge?",
  ].join("\n\n")
}

/**
 * Assess a single user message for crisis signals. Deterministic and
 * model-independent. Order matters: suicide is checked first because it is the
 * highest-stakes category and some phrases overlap.
 */
export function assessCrisis(text: string): CrisisAssessment {
  const none: CrisisAssessment = {
    flagged: false,
    severity: "none",
    kind: null,
    response: "",
    guidance: "",
  }

  const lower = (text || "").toLowerCase()
  if (!lower.trim()) return none

  // Guard against obvious negations that flip meaning ("I don't want to die",
  // "I would never kill myself"). We keep this narrow — only the clearest
  // negations — because over-suppressing here reintroduces the false-negative
  // risk the whole module exists to prevent.
  const isClearlyNegated = (phraseFound: boolean): boolean => {
    if (!phraseFound) return false
    return /\b(don'?t|do not|never|not|wouldn'?t|won'?t)\b[^.?!]{0,24}\b(want|going|kill|hurt|harm|end)\b/i.test(
      lower
    )
  }

  // --- Crisis tier: hard pre-empt, fixed resource-bearing response. ---
  const suicide = containsPhrase(lower, SUICIDE_PHRASES)
  if (suicide && !isClearlyNegated(suicide)) {
    return { flagged: true, severity: "crisis", kind: "suicide", response: suicideResponse(), guidance: "" }
  }

  const selfHarm = containsPhrase(lower, SELF_HARM_PHRASES)
  if (selfHarm && !isClearlyNegated(selfHarm)) {
    return { flagged: true, severity: "crisis", kind: "self-harm", response: selfHarmResponse(), guidance: "" }
  }

  const harmOther = containsPhrase(lower, HARM_OTHER_PHRASES)
  if (harmOther && !isClearlyNegated(harmOther)) {
    return { flagged: true, severity: "crisis", kind: "harm-other", response: harmOtherResponse(), guidance: "" }
  }

  // --- Concern tier: soft signal. NOT flagged, no pre-empt — just a gentle
  // steering note so the model's own reply leans toward an attentive check-in.
  const concern = containsPhrase(lower, CONCERN_PHRASES)
  if (concern && !isClearlyNegated(concern)) {
    return {
      flagged: false,
      severity: "concern",
      kind: "distress",
      response: "",
      guidance:
        "This person is sounding hopeless or worn down. Slow right down and stay close — make them feel genuinely heard before anything else. Gently check how heavy things are getting for them right now (something like 'that sounds really heavy — how are you actually holding up?'). Do not list crisis hotlines unless they say something that signals real danger; right now they need warmth and your full attention, not a referral.",
    }
  }

  return none
}

// ---------------------------------------------------------------------------
// Rising-pattern escalation.
//
// A single "concern" message is handled gently in-conversation (no hotlines).
// But concern that KEEPS recurring across a conversation is itself a signal —
// someone circling hopelessness for several turns, without ever saying a
// crisis phrase, can be in just as much danger as someone who does. So we
// watch the trend: when concern recurs enough, we escalate to a warm,
// resource-bearing check-in — softer than the crisis pre-empt, but it does
// offer a real way to reach a person.
//
// This stays deterministic and testable: the caller passes the recent severity
// history; this function decides. No state lives here.
// ---------------------------------------------------------------------------

// How many "concern" turns within the recent window trigger escalation.
const CONCERN_ESCALATION_THRESHOLD = 3
// How many recent turns we look back over.
const CONCERN_ESCALATION_WINDOW = 5

const RESOURCES_SOFT = [
  "• US & Canada: 988 (call or text), 24/7.",
  "• UK & Ireland: Samaritans, 116 123.",
  "• Anywhere: findahelpline.com.",
].join("\n")

export interface ConversationSafetyResult {
  // True when the recurring-concern pattern warrants a gentle, resource-bearing
  // check-in this turn. The caller shows `message` as an assistant turn.
  escalate: boolean
  message: string
}

/**
 * Decide whether a run of "concern" turns has built up enough to warrant a
 * gentle escalation. `recentSeverities` should be ordered oldest→newest and
 * INCLUDE the current turn's severity. A crisis turn is handled elsewhere (the
 * hard pre-empt), so this only acts on accumulated concern.
 */
export function assessConversationSafety(
  recentSeverities: CrisisSeverity[]
): ConversationSafetyResult {
  const noEscalation: ConversationSafetyResult = { escalate: false, message: "" }
  if (!Array.isArray(recentSeverities) || recentSeverities.length === 0) {
    return noEscalation
  }

  const window = recentSeverities.slice(-CONCERN_ESCALATION_WINDOW)
  // Only escalate on the turn that is itself a concern — escalating on a turn
  // where the person just lightened up would feel jarring and unearned.
  if (window[window.length - 1] !== "concern") {
    return noEscalation
  }

  const concernCount = window.filter((s) => s === "concern").length
  if (concernCount < CONCERN_ESCALATION_THRESHOLD) {
    return noEscalation
  }

  return {
    escalate: true,
    message: [
      "I've been here with you for a little while now, and I can feel how much you're carrying — it keeps coming back to a heavy place.",
      "I care about how you're doing, and because I'm just an AI, I want you to also have a person who can really be with you in this:",
      RESOURCES_SOFT,
      "I'm not going anywhere either. We can keep talking for as long as you need.",
    ].join("\n\n"),
  }
}
