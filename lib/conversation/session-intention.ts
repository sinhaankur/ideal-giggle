// Session intention — the person's answer to "how do you want to feel by the
// end?" Unlike the granular Conversation Tone setting (casual/balanced/deep),
// this names the *destination* of the session and steers the companion's whole
// approach toward it: what to emphasize, what to avoid, and where to land.
//
// The directive flows into the per-turn guidance the model reads (alongside
// the accumulated self and any safety steering), so the intention colors every
// reply without overriding tone or the crisis-safety floor.

export type SessionIntentionId =
  | "calmer"
  | "unstuck"
  | "heard"
  | "connected"
  | "lighter"

export interface SessionIntentionOption {
  id: SessionIntentionId
  // Short label for the picker chip.
  label: string
  // The full first-person phrasing ("I want to feel calmer").
  prompt: string
  // Private steering note folded into the model's guidance. Plain language,
  // no clinical vocabulary — consistent with the friend-first system prompt.
  directive: string
}

export const SESSION_INTENTIONS: SessionIntentionOption[] = [
  {
    id: "calmer",
    label: "Calmer",
    prompt: "I want to feel calmer",
    directive:
      "They came here to settle. Slow your pace, soften your wording, and help their nervous system come down before anything else. Favor grounding and reassurance over analysis; don't pile on questions. It's fine to just be steady with them.",
  },
  {
    id: "unstuck",
    label: "Unstuck",
    prompt: "I want to get unstuck",
    directive:
      "They want movement. After you understand the knot, gently help them find one small, doable next step or a fresh angle — not a lecture, just a nudge toward traction. Keep hope in view without dismissing how stuck it feels.",
  },
  {
    id: "heard",
    label: "Heard",
    prompt: "I just want to be heard",
    directive:
      "They want to be heard, not fixed. Reflect closely and stay with what they're feeling. Resist offering solutions or steps unless they ask — your job is presence and accurate understanding. Questions should deepen, not redirect.",
  },
  {
    id: "connected",
    label: "Connected",
    prompt: "I want to feel less alone",
    directive:
      "They're reaching for connection. Be warm, personal, and present — reference what you know about them, meet their energy, and let the conversation feel like being with someone who genuinely cares. Reduce any clinical distance.",
  },
  {
    id: "lighter",
    label: "Lighter",
    prompt: "I want to feel lighter",
    directive:
      "They want some lift. Allow warmth, gentle lightness, even a little play where it fits — without dismissing anything real underneath. Help them find a bit of perspective or relief, and don't force depth they didn't ask for.",
  },
]

export function getSessionIntention(id: SessionIntentionId | null | undefined): SessionIntentionOption | null {
  if (!id) return null
  return SESSION_INTENTIONS.find((opt) => opt.id === id) ?? null
}

// The steering line for the per-turn guidance. Empty when no intention is set.
export function sessionIntentionDirective(id: SessionIntentionId | null | undefined): string {
  const option = getSessionIntention(id)
  if (!option) return ""
  return `The person set an intention for this session: "${option.prompt}." Keep gently steering toward that. ${option.directive}`
}
