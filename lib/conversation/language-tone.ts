export type HarshLanguageKind = "profanity" | "self-directed" | "violent-ideation"

export interface HarshLanguageSignal {
  flagged: boolean
  kind: HarshLanguageKind | null
  message: string
}

const PROFANITY_WORDS = [
  "fuck",
  "shit",
  "damn",
  "bitch",
  "asshole",
  "bastard",
  "crap",
  "dick",
  "piss",
]

const SELF_DIRECTED_PHRASES = [
  "i hate myself",
  "i'm worthless",
  "i am worthless",
  "i'm useless",
  "i am useless",
  "i'm stupid",
  "i am stupid",
  "i'm a failure",
  "i am a failure",
  "i deserve nothing",
  "no one cares about me",
  "nobody cares about me",
]

const VIOLENT_IDEATION_PHRASES = [
  "kill myself",
  "end my life",
  "want to die",
  "wish i was dead",
  "wish i were dead",
  "hurt myself",
]

function containsAny(haystack: string, needles: string[]): string | null {
  for (const needle of needles) {
    if (haystack.includes(needle)) return needle
  }
  return null
}

function hasWordBoundaryMatch(haystack: string, words: string[]): string | null {
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const re = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i")
    if (re.test(haystack)) return word
  }
  return null
}

export function detectHarshLanguage(text: string): HarshLanguageSignal {
  const lower = text.toLowerCase()

  const violent = containsAny(lower, VIOLENT_IDEATION_PHRASES)
  if (violent) {
    return {
      flagged: true,
      kind: "violent-ideation",
      message:
        "I hear how heavy this is. If you are in danger, please reach a crisis line. I can stay with you here too — tell me what triggered this.",
    }
  }

  const selfDirected = containsAny(lower, SELF_DIRECTED_PHRASES)
  if (selfDirected) {
    return {
      flagged: true,
      kind: "self-directed",
      message:
        "I noticed harsh words about yourself. We can keep talking — what would you say to a close friend in this exact moment?",
    }
  }

  const profanity = hasWordBoundaryMatch(lower, PROFANITY_WORDS)
  if (profanity) {
    return {
      flagged: true,
      kind: "profanity",
      message:
        "I hear the heat in those words. No need to soften — keep going. What is underneath the frustration?",
    }
  }

  return { flagged: false, kind: null, message: "" }
}
