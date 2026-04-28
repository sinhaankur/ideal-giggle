import type { Emotion } from "@/lib/companion-types"
import type { UserUnderstanding } from "./communication-engine"

export interface QABankSignal {
  emotion: Emotion
  understanding: UserUnderstanding
  sentimentScore: number
}

export interface QABankEntry {
  id: string
  matches: (signal: QABankSignal) => boolean
  reflections: string[]
  questions: string[]
}

const BANK: QABankEntry[] = [
  {
    id: "vent-high-load",
    matches: (s) =>
      s.understanding.primaryIntent === "venting" && s.understanding.emotionalLoad === "high",
    reflections: [
      "That's a lot to be carrying. I'm right here.",
      "I hear how much pressure is on you. You don't have to compress it.",
      "It makes sense to feel flooded. Take whatever space you need.",
      "That weight is real. You don't need to perform okay-ness here.",
      "I'm with you in this. Let's slow down for a moment.",
    ],
    questions: [
      "If you had to put one word on what's hardest right now, what would it be?",
      "Want to keep venting, or is there one piece you'd like to set down first?",
      "What's the part of this that no one else is seeing?",
      "Is there one specific moment from today that captures the whole feeling?",
    ],
  },
  {
    id: "sad-low-openness",
    matches: (s) => s.emotion === "sad" && s.understanding.openness === "low",
    reflections: [
      "I notice the heaviness, and I'm not going anywhere.",
      "We don't have to dig fast. I'm here at whatever pace.",
      "Sadness has its own pace. We can match it.",
      "I'll keep it simple — you don't have to explain everything.",
    ],
    questions: [
      "Is there a small thing today that felt okay, even briefly?",
      "Would it help to just sit with this for a minute?",
      "If words feel like too much, a single image works too — what comes up?",
      "Yes/no is fine: do you want me to ask anything, or just stay near?",
    ],
  },
  {
    id: "angry-venting",
    matches: (s) => s.emotion === "angry" && s.understanding.primaryIntent === "venting",
    reflections: [
      "I hear the heat. That sounds like it earned every degree.",
      "Anger usually has a story. I want to hear yours.",
      "That's righteous frustration. You don't need to soften it.",
      "Makes sense to be furious about that.",
    ],
    questions: [
      "What part of this feels most unfair?",
      "If anger could speak directly, what would it want named first?",
      "Is the anger pointing at the situation, the person, or yourself?",
      "What would justice or repair actually look like here?",
    ],
  },
  {
    id: "fear-grounded",
    matches: (s) => s.emotion === "fear",
    reflections: [
      "Fear is hard to be alone with. I'm right here.",
      "Anxiety has a way of speaking in worst-cases. Let's slow it down.",
      "I hear how unsettled this feels. Let's get our footing.",
      "Whatever shape this fear has, it's allowed to be here.",
    ],
    questions: [
      "Is the fear about something specific, or is it a general weather right now?",
      "If the worst-case actually happened, what would you most want to be true about how you handled it?",
      "Where in the body does the fear sit most?",
      "What's one thing in this room that feels solid right now?",
    ],
  },
  {
    id: "happy-anchor",
    matches: (s) => s.emotion === "happy",
    reflections: [
      "That sounds good. I want to stay here for a moment.",
      "There's real lightness in that. I notice it.",
      "Glad to hear that landing well for you.",
      "That has some real warmth in it.",
    ],
    questions: [
      "What about it surprised you, in a good way?",
      "Is there a smaller detail underneath the headline that's the actual gold?",
      "Want to anchor this — anything you'd say to remember the feeling later?",
      "Who or what helped this happen?",
    ],
  },
  {
    id: "problem-solving",
    matches: (s) => s.understanding.primaryIntent === "problem-solving",
    reflections: [
      "Okay, let's think this through with you.",
      "I'm in. Let's break it down.",
      "Got it — let's get concrete.",
      "Right, let's narrow it.",
    ],
    questions: [
      "What's the smallest version of this you'd like to try first?",
      "What have you already ruled out or tried?",
      "If it had to be solved by tomorrow, what would you focus on?",
      "What does 'solved' actually look like for you on this one?",
    ],
  },
  {
    id: "reflection",
    matches: (s) => s.understanding.primaryIntent === "reflection",
    reflections: [
      "There's something thoughtful in how you're framing this.",
      "I notice you're already turning it over. Let's go a layer down.",
      "You're noticing a pattern. Let's stay with it.",
      "That has the shape of something you've been circling for a while.",
    ],
    questions: [
      "What does this remind you of from earlier in your life?",
      "If a close friend told you this exact thing, what would you reflect back?",
      "What's the quieter feeling underneath the obvious one?",
      "Where does this story usually go for you, and is that where you want it to go now?",
    ],
  },
  {
    id: "check-in",
    matches: (s) => s.understanding.primaryIntent === "check-in",
    reflections: [
      "I'm here, glad you stopped by.",
      "Good to be checked in on.",
      "Thanks for that — I'm steady.",
      "I'm with you. That's a kind question to start with.",
    ],
    questions: [
      "How are you actually doing today?",
      "What brought you in this time?",
      "Is there anything sitting heavy that you want to mention?",
      "What would feel like a good use of the next few minutes for you?",
    ],
  },
  {
    id: "low-openness",
    matches: (s) => s.understanding.openness === "low",
    reflections: [
      "No pressure to dig. I'm just here.",
      "We can keep this small. That's allowed.",
      "Whatever you want to say is enough.",
      "You don't owe me a full story.",
    ],
    questions: [
      "Even one sentence is plenty — what's on top right now?",
      "Want me to just listen for a bit?",
      "Yes/no is fine: are you okay enough to keep going?",
      "Pick one word for how today has been so far.",
    ],
  },
  {
    id: "negative-sentiment",
    matches: (s) => s.sentimentScore <= -0.6,
    reflections: [
      "That sounds heavy, and I appreciate you staying with it.",
      "There's a lot underneath that, and you're not alone with it.",
      "I can feel the weight in what you just said.",
      "I'm not rushing you out of this.",
    ],
    questions: [
      "What part of this feels most true right now?",
      "Is there a piece of this you've been holding alone?",
      "What would 'a little less heavy' even look like today?",
    ],
  },
  {
    id: "default",
    matches: () => true,
    reflections: [
      "I hear you.",
      "I'm with you in it.",
      "That makes sense.",
      "Got you — let's stay with this.",
    ],
    questions: [
      "What feels most true right now?",
      "Where would you like to put your attention?",
      "What's the thread you most want to pull on?",
      "What would help most in the next few minutes?",
    ],
  },
]

function nextRand(seed: number): number {
  return ((seed * 1103515245 + 12345) >>> 0)
}

export function selectFromQABank(
  signal: QABankSignal,
  seed: number
): { reflection: string; question: string; entryId: string } {
  const entry = BANK.find((e) => e.matches(signal)) ?? BANK[BANK.length - 1]
  let rnd = nextRand(seed >>> 0)
  const reflection = entry.reflections[rnd % entry.reflections.length]
  rnd = nextRand(rnd)
  const question = entry.questions[rnd % entry.questions.length]
  return { reflection, question, entryId: entry.id }
}

export function listQABankIds(): string[] {
  return BANK.map((entry) => entry.id)
}
