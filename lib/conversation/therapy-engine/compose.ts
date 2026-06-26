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

// Optional context that makes a composed reply feel less like a template and
// more like a person who's been in the conversation. All fields are optional
// so existing callers keep working unchanged.
export interface ComposeContext {
  // The person's preferred name. Used sparingly (never every turn) and only in
  // roomier doses, the way a friend drops your name now and then.
  preferredName?: string
  // The composer's previous reply. When a freshly-picked line would repeat it,
  // we nudge the seed and pick a different variant so turns don't echo.
  lastReply?: string
}

// Bank of openers per intent + register. Each list has multiple entries
// so the composer can pick a non-repeating one via the seed.
const WITNESS_LINES = [
  "Mm. I'm right here.",
  "Yeah. I'm with you.",
  "I'm here — take all the time you need.",
  "Stay with that. I'm not going anywhere.",
  "Take your time. There's no rush here.",
  "Okay. I hear you.",
  "I'm listening.",
]

const VALIDATE_LINES = [
  "That makes complete sense for what just happened.",
  "Of course you feel that — anyone would, and it's okay.",
  "That weight is real. You're not making it up or being dramatic.",
  "The fact that this lands so hard says something true about how much it matters.",
  "It's allowed to feel this heavy. You don't have to talk yourself out of it.",
  "That sounds genuinely hard, and I'm glad you said it out loud.",
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

// Like pickSeeded, but skips a candidate that would reproduce a line already
// used in the reply being built (or the previous turn's reply). Keeps the
// composer from echoing itself.
function pickFresh(pool: string[], seed: number, avoid: string[]): string {
  if (pool.length === 0) return ""
  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[(seed + i) % pool.length]
    if (!avoid.some((a) => a && a.trim() === candidate.trim())) return candidate
  }
  return pool[seed % pool.length]
}

// A small set of natural body words → the phrase the composer can weave into a
// reflection so the reply acknowledges the body the user named.
function bodyMention(bodyAnchors: string[]): string | null {
  const a = bodyAnchors.map((x) => x.toLowerCase())
  if (a.some((x) => x.includes("chest"))) return "the tightness in your chest"
  if (a.some((x) => x.includes("throat"))) return "that catch in your throat"
  if (a.some((x) => x.includes("stomach") || x.includes("gut"))) return "that knot in your stomach"
  if (a.some((x) => x.includes("jaw"))) return "the clench in your jaw"
  if (a.some((x) => x.includes("breath") || x.includes("heart"))) return "how fast everything's moving in your body"
  return null
}

function quotedSnippet(userText: string): string | null {
  const compact = userText.replace(/\s+/g, " ").trim()
  if (compact.length < 6) return null
  const words = compact.split(/\s+/).slice(0, 10)
  return words.join(" ")
}

function composeReflect(
  userText: string,
  seed: number,
  bodyAnchors: string[],
  avoid: string[]
): string {
  const snippet = quotedSnippet(userText)
  if (!snippet) {
    return pickFresh(
      [
        "Say more about that.",
        "Mm. Go on.",
        "Tell me what just shifted as you said that.",
      ],
      seed,
      avoid
    )
  }
  // When the user named a body sensation, sometimes reflect through it — it
  // lands as much closer listening than a bare word-quote.
  const body = bodyMention(bodyAnchors)
  if (body && seed % 2 === 0) {
    return pickFresh(
      [
        `"${snippet}" — and I can hear ${body} right there with it. What's that part holding?`,
        `When you say "${snippet}", ${body} makes sense. Stay with it a second — what's underneath?`,
      ],
      seed,
      avoid
    )
  }
  return pickFresh(
    [
      `When you say "${snippet}" — what's underneath that for you?`,
      `Mm. "${snippet}". Stay with that for a beat.`,
      `"${snippet}" — yeah. What part of it feels loudest right now?`,
    ],
    seed,
    avoid
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

// Lightly weave the person's name into one line of a roomier reply — not
// every turn, and never on micro/short doses (those need to stay spare). A
// friend uses your name occasionally, as punctuation, not constantly.
function maybeAddName(line: string, name: string | undefined, seed: number): string {
  if (!name) return line
  const clean = name.trim()
  if (!clean) return line
  // ~1 in 3 eligible lines, deterministic on the seed.
  if (seed % 3 !== 0) return line
  // Only attach to a statement, not a question, and only if the name isn't
  // already there. Prepend as a soft address: "Yeah — Sam, that ..." reads
  // worse than a gentle leading "Sam — ", so use that form.
  if (line.includes(clean)) return line
  if (line.trimEnd().endsWith("?")) return line
  return `${clean} — ${line.charAt(0).toLowerCase()}${line.slice(1)}`
}

// Render a full response from a plan + the user's latest message. The
// seed (a number) is used to pick variants so repeat turns don't read
// the same. Optional context lets the reply use the person's name and avoid
// echoing the previous turn.
export function composeFromPlan(
  plan: ResponsePlan,
  userText: string,
  seed: number,
  context?: ComposeContext
): string {
  const parts: string[] = []
  // Lines to avoid reproducing: anything already in this reply, plus the
  // sentences of the previous turn's reply so consecutive turns don't echo.
  // We split the previous reply back into sentence-ish pieces because the
  // composer picks line-by-line — comparing against the whole blob would
  // never catch a repeated opener.
  const avoid: string[] = []
  if (context?.lastReply) {
    const prev = context.lastReply.trim()
    avoid.push(prev)
    for (const piece of prev.split(/(?<=[.!?])\s+/)) {
      const t = piece.trim()
      if (t) avoid.push(t)
    }
  }

  const push = (line: string) => {
    if (!line) return
    parts.push(line)
    avoid.push(line.trim())
  }

  // Name use is reserved for roomier replies and applied to at most one line.
  const roomyEnough = plan.dose === "standard" || plan.dose === "long"
  let nameUsed = false

  // Intent 1 leads. Each intent contributes a sentence (or, for micro,
  // a single line and we stop).
  for (const intent of plan.intents) {
    if (plan.dose === "micro" && parts.length > 0) break
    if (plan.dose === "short" && parts.length > 1) break
    if (plan.dose === "standard" && parts.length > 2) break

    const s = seed + parts.length
    const turn = (intent as ResponseIntent)
    switch (turn) {
      case "witness":
        push(pickFresh(WITNESS_LINES, s, avoid))
        break
      case "validate": {
        let line = pickFresh(VALIDATE_LINES, s, avoid)
        if (roomyEnough && !nameUsed) {
          const named = maybeAddName(line, context?.preferredName, s)
          if (named !== line) nameUsed = true
          line = named
        }
        push(line)
        break
      }
      case "reflect":
        push(composeReflect(userText, s, plan.bodyAnchors, avoid))
        break
      case "clarify":
        if (plan.mustAskQuestion) push(composeClarify(s))
        break
      case "anchor":
        push(composeAnchor(plan.bodyAnchors, s))
        break
      case "reframe":
        push(pickFresh(REFRAME_LINES, s, avoid))
        break
      case "affirm": {
        let line = pickFresh(AFFIRM_LINES, s, avoid)
        if (roomyEnough && !nameUsed) {
          const named = maybeAddName(line, context?.preferredName, s)
          if (named !== line) nameUsed = true
          line = named
        }
        push(line)
        break
      }
      case "bridge":
        push(pickFresh(BRIDGE_LINES, s, avoid))
        break
      case "mobilize":
        push(pickFresh(MOBILIZE_LINES, s, avoid))
        break
      case "summarize": {
        const snippet = quotedSnippet(userText)
        const opener = pickSeeded(SUMMARY_OPENER, seed)
        push(
          snippet
            ? `${opener}"${snippet}" — and what's living under that.`
            : `${opener}what's living under what you've named.`
        )
        break
      }
    }
  }

  return parts.filter(Boolean).join(" ").trim()
}
