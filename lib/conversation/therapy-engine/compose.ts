// Plan → text composer for the local fallback path. When no LLM is
// loaded (or it fails), we still produce a calibrated reply by
// assembling sentences according to the plan. The composer always
// honors the plan's mustQuoteUser, dose, and mustAskQuestion rules.
//
// This is the path that runs when the user is fully offline. It will
// never be as nuanced as a 1B+ LLM, but it should never feel robotic
// either — because the dose / intent / pacing are picked deliberately
// rather than always doing the same reflection-plus-question shape.

import type { ResponseIntent, ResponsePlan } from "./types"

// Bank of openers per intent + register. Each list has multiple entries
// so the composer can pick a non-repeating one via the seed.
const WITNESS_LINES = [
  "Mm.",
  "Yeah.",
  "I'm here.",
  "Stay with that.",
  "Take your time.",
  "Okay.",
]

const VALIDATE_LINES = [
  "That makes sense for what just happened.",
  "Of course you feel that. Anyone would.",
  "That weight is real, not a story you're making up.",
  "The fact that this lands hard says something true.",
]

const ANCHOR_LINES = [
  "Let's slow it down for a second. Feet on the floor.",
  "Before anything else — one slow exhale.",
  "Your body's running the show right now. Let's give it a beat.",
  "Notice what's solid under you. Just for a moment.",
]

const AFFIRM_LINES = [
  "You showed up. That part isn't nothing.",
  "Naming it the way you just did takes something.",
  "You're being more honest than most people manage on a good day.",
  "The fact that you can say it out loud is the move.",
]

const BRIDGE_LINES = [
  "What does it tell you about what matters to you?",
  "What part of you was hoping for something different?",
  "If you trace this back, what value is being touched?",
]

const MOBILIZE_LINES = [
  "What's the smallest thing — really small — that could move this an inch?",
  "If 'next step' had to fit in 10 minutes, what would it be?",
  "What's one tiny thing future-you would thank you for tonight?",
]

const REFRAME_LINES = [
  "I wonder if there's a version of this where it's less about you failing and more about something asking to be named.",
  "What if the heaviness isn't a sign you're broken but a sign you've been carrying too much alone?",
  "Is it possible the part of you that's frustrated is also the part that still cares?",
]

const SUMMARY_OPENER = [
  "So if I'm tracking — ",
  "Pulling the thread, what I'm hearing is — ",
  "Here's what I think you're working through — ",
]

function pickSeeded<T>(pool: T[], seed: number): T {
  return pool[seed % pool.length]
}

function quotedSnippet(userText: string): string | null {
  const compact = userText.replace(/\s+/g, " ").trim()
  if (compact.length < 6) return null
  const words = compact.split(/\s+/).slice(0, 10)
  return words.join(" ")
}

function composeReflect(userText: string, seed: number): string {
  const snippet = quotedSnippet(userText)
  if (!snippet) {
    return pickSeeded(
      [
        "Say more about that.",
        "Mm. Go on.",
        "Tell me what just shifted as you said that.",
      ],
      seed
    )
  }
  return pickSeeded(
    [
      `When you say "${snippet}" — what's underneath that for you?`,
      `Mm. "${snippet}". Stay with that for a beat.`,
      `"${snippet}" — yeah. What part of it feels loudest right now?`,
    ],
    seed
  )
}

function composeClarify(seed: number): string {
  return pickSeeded(
    [
      "What were you doing right before this hit?",
      "Who else is in this picture with you?",
      "Where in the day did this start?",
      "What's the part of it you most want me to understand?",
    ],
    seed
  )
}

function composeAnchor(bodyAnchors: string[], seed: number): string {
  if (bodyAnchors.includes("shallow breath") || bodyAnchors.includes("racing heart")) {
    return pickSeeded(
      [
        "Let's slow the breath first. In for four, out for six. Then we can keep going.",
        "Your nervous system is online and loud. One slow exhale before we say anything else.",
      ],
      seed
    )
  }
  if (bodyAnchors.includes("tight chest")) {
    return pickSeeded(
      [
        "Soften the chest if you can. Even a millimeter. The story can wait.",
        "Hand on your chest. Just notice. We don't have to fix anything yet.",
      ],
      seed
    )
  }
  return pickSeeded(ANCHOR_LINES, seed)
}

// Render a full response from a plan + the user's latest message. The
// seed (a number) is used to pick variants so repeat turns don't read
// the same.
export function composeFromPlan(
  plan: ResponsePlan,
  userText: string,
  seed: number
): string {
  const parts: string[] = []

  // Intent 1 leads. Each intent contributes a sentence (or, for micro,
  // a single line and we stop).
  for (const intent of plan.intents) {
    if (plan.dose === "micro" && parts.length > 0) break
    if (plan.dose === "short" && parts.length > 1) break
    if (plan.dose === "standard" && parts.length > 2) break

    const turn = (intent as ResponseIntent)
    switch (turn) {
      case "witness":
        parts.push(pickSeeded(WITNESS_LINES, seed + parts.length))
        break
      case "validate":
        parts.push(pickSeeded(VALIDATE_LINES, seed + parts.length))
        break
      case "reflect":
        parts.push(composeReflect(userText, seed + parts.length))
        break
      case "clarify":
        if (plan.mustAskQuestion) parts.push(composeClarify(seed + parts.length))
        break
      case "anchor":
        parts.push(composeAnchor(plan.bodyAnchors, seed + parts.length))
        break
      case "reframe":
        parts.push(pickSeeded(REFRAME_LINES, seed + parts.length))
        break
      case "affirm":
        parts.push(pickSeeded(AFFIRM_LINES, seed + parts.length))
        break
      case "bridge":
        parts.push(pickSeeded(BRIDGE_LINES, seed + parts.length))
        break
      case "mobilize":
        parts.push(pickSeeded(MOBILIZE_LINES, seed + parts.length))
        break
      case "summarize": {
        const snippet = quotedSnippet(userText)
        const opener = pickSeeded(SUMMARY_OPENER, seed)
        parts.push(snippet ? `${opener}"${snippet}" — and what's living under that.` : `${opener}what's living under what you've named.`)
        break
      }
    }
  }

  return parts.filter(Boolean).join(" ").trim()
}
