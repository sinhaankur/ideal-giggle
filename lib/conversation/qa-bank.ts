import type { Emotion } from "@/lib/companion-types"
import type { UserUnderstanding } from "./communication-engine"

export interface QABankSignal {
  emotion: Emotion
  understanding: UserUnderstanding
  sentimentScore: number
}

// Reflections are written in therapist voice and may contain a `{phrase}`
// placeholder. The caller (`buildLocalCompanionReply`) substitutes the
// user's literal words there. Templates without `{phrase}` are
// always-safe variants used when there's no usable phrase to mirror.
//
// Style rules baked into these strings:
//   - No "I hear you" alone, no "Thank you for sharing", no
//     "That sounds [adjective]" — those are stock-phrase tells.
//   - Whenever possible, mirror the user's words back literally.
//   - Vary structure: sometimes a single sentence, sometimes a hold,
//     occasionally a concrete question with no preamble.
//   - Use short, clean lines. A real therapist isn't writing a paragraph.
//
// `holding: true` on an entry tells the caller this is a "say less"
// state — minimum-words response, often skip the question entirely.
export interface QABankEntry {
  id: string
  matches: (signal: QABankSignal) => boolean
  reflections: string[]
  questions: string[]
  holding?: boolean
}

const BANK: QABankEntry[] = [
  {
    id: "vent-high-load",
    matches: (s) =>
      s.understanding.primaryIntent === "venting" && s.understanding.emotionalLoad === "high",
    reflections: [
      "Yeah. {phrase}. Keep going.",
      "{phrase} — that's a stack. I'm not rushing you.",
      "Mm. That's a lot at once. Let it out.",
      "{phrase}. You don't have to make it neat.",
      "Okay. I'm right here. Don't compress it.",
    ],
    questions: [
      "What was the last straw today?",
      "Who is in this picture with you, and who isn't?",
      "Is there a specific moment that captures the whole thing?",
      "What part of this haven't you been able to say out loud anywhere else?",
    ],
  },
  {
    id: "sad-low-openness",
    matches: (s) => s.emotion === "sad" && s.understanding.openness === "low",
    holding: true,
    reflections: [
      "Mm.",
      "I'm here. No pressure to explain.",
      "Take your time. I'm not going anywhere.",
      "Yeah.",
      "Okay. I'll just be here for a minute.",
    ],
    questions: [
      "One word for today, when you're ready.",
      "Yes or no — do you want me to ask anything, or just stay near?",
      "If words feel like too much, I'll wait.",
    ],
  },
  {
    id: "angry-venting",
    matches: (s) => s.emotion === "angry" && s.understanding.primaryIntent === "venting",
    reflections: [
      "{phrase} — yeah, the heat is earned.",
      "Mm. {phrase}. Don't soften it for me.",
      "Okay. That's fair anger. Tell me the rest.",
      "{phrase}. What did they actually do or say?",
      "Yeah. I'm listening to all of it.",
    ],
    questions: [
      "What did they actually do or say in that moment?",
      "What were you hoping for that didn't happen?",
      "Is the anger pointing at the situation, the person, or yourself?",
      "If you could say the unedited version to their face, what would it be?",
    ],
  },
  {
    id: "fear-grounded",
    matches: (s) => s.emotion === "fear",
    reflections: [
      "{phrase} — okay. Let's find your feet first.",
      "Yeah. The fear's loud right now. I'm here.",
      "{phrase}. What does your chest feel like as you say that?",
      "Stay with me. We'll go slow.",
      "{phrase}. Tell me one thing in the room you can see.",
    ],
    questions: [
      "Where in your body is the fear sitting right now?",
      "What's something solid under your feet — floor, shoes, ground?",
      "Is the fear about something specific, or is it more like weather?",
      "When did you last feel even one notch safer than this?",
    ],
  },
  {
    id: "happy-anchor",
    matches: (s) => s.emotion === "happy",
    reflections: [
      "{phrase} — let it land.",
      "Yeah, that's something. Don't move past it too fast.",
      "Mm. {phrase}. Tell me more.",
      "{phrase}. What did it feel like in your body?",
    ],
    questions: [
      "Where in your body is the warmth right now?",
      "What part of you knew this was possible? That part deserves the credit.",
      "Who or what helped this happen — name it out loud.",
      "What's a small thing you'd say to remember this feeling later?",
    ],
  },
  {
    id: "problem-solving",
    matches: (s) => s.understanding.primaryIntent === "problem-solving",
    reflections: [
      "Okay. Let's narrow it.",
      "{phrase} — got it. What's the smallest version we can move on first?",
      "Right. Let's get concrete.",
      "Mm. Tell me what you've already ruled out.",
      "{phrase}. What's the actual deadline here?",
    ],
    questions: [
      "What's the cheapest experiment you could run today?",
      "What have you already tried that didn't work, and why didn't it?",
      "If it had to be solved by tomorrow, what's the one move?",
      "What does 'solved' actually look like for you on this one?",
    ],
  },
  {
    id: "reflection",
    matches: (s) => s.understanding.primaryIntent === "reflection",
    reflections: [
      "{phrase} — yeah, you're already mid-thought on this.",
      "Stay with that. Keep talking it out.",
      "Mm. {phrase}. What else?",
      "{phrase}. What does that connect to for you?",
      "I'm listening. Go a layer down.",
    ],
    questions: [
      "What's the quieter version of that thought, the one you don't say out loud?",
      "If you were watching someone else say what you just said, what would you notice about them?",
      "What does this remind you of from earlier in your life?",
      "Where does this story usually go for you, and is that where you want it to go now?",
    ],
  },
  {
    id: "check-in",
    matches: (s) => s.understanding.primaryIntent === "check-in",
    reflections: [
      "Hey. Glad you stopped in.",
      "I'm here. How's today landing on you?",
      "Good to see you.",
      "Mm. What brought you in just now?",
    ],
    questions: [
      "What's something true about today you haven't said out loud yet?",
      "Body or mind — which one is louder right now?",
      "Pick one word for how today's going so far.",
      "What would feel like a good use of the next few minutes?",
    ],
  },
  {
    id: "low-openness",
    matches: (s) => s.understanding.openness === "low",
    holding: true,
    reflections: [
      "Mm.",
      "I'm here. No need to explain.",
      "Whatever you want to say is enough.",
      "Okay.",
    ],
    questions: [
      "One word, if you're up for it.",
      "Yes or no — okay enough to keep going?",
      "Just tap when you're ready.",
    ],
  },
  {
    id: "negative-sentiment",
    matches: (s) => s.sentimentScore <= -0.6,
    reflections: [
      "{phrase} — that's heavy.",
      "Yeah. {phrase}. I'm staying with you on this.",
      "Mm. Don't rush yourself out of this.",
      "{phrase}. What part of it have you been holding alone?",
    ],
    questions: [
      "What part of this feels most true right now?",
      "Is there a piece of this you've been carrying without telling anyone?",
      "What would 'one notch lighter' even look like today?",
    ],
  },
  {
    id: "default",
    matches: () => true,
    reflections: [
      "{phrase}. Say more about that.",
      "Mm. {phrase} — what's underneath that?",
      "I'm here. Tell me what just happened that brought this on.",
      "Okay. {phrase}. Take me through it.",
      "Go on.",
    ],
    questions: [
      "What were you doing right before this hit?",
      "Where in the day did this start?",
      "Who else is in this picture?",
      "What's the part of it you most want me to understand?",
    ],
  },
]

function nextRand(seed: number): number {
  return ((seed * 1103515245 + 12345) >>> 0)
}

export function selectFromQABank(
  signal: QABankSignal,
  seed: number
): { reflection: string; question: string; entryId: string; holding: boolean } {
  const entry = BANK.find((e) => e.matches(signal)) ?? BANK[BANK.length - 1]
  let rnd = nextRand(seed >>> 0)
  const reflection = entry.reflections[rnd % entry.reflections.length]
  rnd = nextRand(rnd)
  const question = entry.questions[rnd % entry.questions.length]
  return { reflection, question, entryId: entry.id, holding: Boolean(entry.holding) }
}

export function listQABankIds(): string[] {
  return BANK.map((entry) => entry.id)
}
