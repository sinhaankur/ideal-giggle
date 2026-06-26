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
// These read like a real person texting a friend: short, plain, reactive.
// We deliberately avoid the AI tells — em-dash overuse, constant validation,
// therapy-speak ("that weight is real", "what value is being touched"), and
// the same rigid sentence shape every time. Mix of reactions, fragments, and
// the occasional small question. Not every line affirms; some just sit with it.
const WITNESS_LINES = [
  "yeah. i'm here.",
  "mm.",
  "ok. with you.",
  "still here.",
  "take your time.",
  "no rush.",
  "i'm listening.",
  "go on.",
]

const VALIDATE_LINES = [
  "yeah, that's a lot.",
  "ugh. that's rough.",
  "honestly, that'd get to anyone.",
  "makes sense you'd feel that.",
  "that's heavy. ok.",
  "no wonder you're worn down.",
  "i get why that stings.",
  "that's fair. it's a lot to hold.",
]

const ANCHOR_LINES = [
  "ok, let's slow down a sec. feet on the floor.",
  "one slow breath first. then we keep going.",
  "your body's pretty wound up right now. give it a beat.",
  "just notice what's solid under you for a moment.",
]

const AFFIRM_LINES = [
  "you showed up. that's not nothing.",
  "saying that out loud takes something.",
  "you're being more honest than most people manage.",
  "that took guts to admit.",
]

const BRIDGE_LINES = [
  "what's that really about for you?",
  "what were you hoping would happen instead?",
  "what matters to you that got touched here?",
]

const MOBILIZE_LINES = [
  "what's the tiniest thing that'd move this even a little?",
  "if it had to fit in ten minutes, what'd you do?",
  "one small thing tonight that future-you would thank you for?",
]

const REFRAME_LINES = [
  "what if this isn't you failing, just you carrying too much alone?",
  "maybe the frustration is the part of you that still cares. worth a thought.",
  "could be this is less about you being broken and more about being tired.",
]

const SUMMARY_OPENER = [
  "ok so, what i'm hearing: ",
  "pulling it together: ",
  "here's what's landing for me: ",
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
      ["say more?", "go on, i'm listening.", "what happened?", "tell me more."],
      seed,
      avoid
    )
  }
  // When the user named a body sensation, sometimes reflect through it — it
  // lands as closer listening than a bare word-quote. Kept casual.
  const body = bodyMention(bodyAnchors)
  if (body && seed % 2 === 0) {
    return pickFresh(
      [
        `i can hear ${body} in that. what's it holding?`,
        `"${snippet}" — yeah, ${body} tracks. what's under it?`,
      ],
      seed,
      avoid
    )
  }
  // Vary the shape so it's never the same quote-back formula every turn. Some
  // just react to the snippet; some ask; some sit with it.
  return pickFresh(
    [
      `"${snippet}" — what's under that?`,
      `yeah, "${snippet}". what part of that hits hardest?`,
      `"${snippet}". say more about that bit.`,
      `i keep landing on "${snippet}". what's going on there?`,
    ],
    seed,
    avoid
  )
}

function composeClarify(seed: number): string {
  return pickSeeded(
    [
      "what happened right before this hit?",
      "who else is in this with you?",
      "when did it start today?",
      "what's the part you most want me to get?",
    ],
    seed
  )
}

function composeAnchor(bodyAnchors: string[], seed: number): string {
  if (bodyAnchors.includes("shallow breath") || bodyAnchors.includes("racing heart")) {
    return pickSeeded(
      [
        "let's slow the breath first. in for four, out for six. then we keep going.",
        "your heart's going fast. one slow exhale before anything else.",
      ],
      seed
    )
  }
  if (bodyAnchors.includes("tight chest")) {
    return pickSeeded(
      [
        "see if the chest can soften, even a little. the story can wait.",
        "hand on your chest. just notice. we don't have to fix anything yet.",
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
  // already there. A comma address ("sam, that's a lot") reads more like a
  // real person than the em-dash form.
  if (line.includes(clean)) return line
  if (line.trimEnd().endsWith("?")) return line
  return `${clean}, ${line.charAt(0).toLowerCase()}${line.slice(1)}`
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

  // Reflect lines embed the user's quote, so two turns can share an identical
  // *template* without any pickFresh collision (the strings differ only by
  // content the avoid-list can't match). When there's a previous reply, nudge
  // the seed so the whole composition shifts to different variants — a robust
  // guarantee that consecutive turns don't read the same.
  if (context?.lastReply) {
    seed = seed + 1 + (context.lastReply.length % 5)
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
            ? `${opener}"${snippet}", and what's sitting under it.`
            : `${opener}there's something under what you've said.`
        )
        break
      }
    }
  }

  return parts.filter(Boolean).join(" ").trim()
}
