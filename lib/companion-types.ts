export type Emotion = "neutral" | "happy" | "sad" | "angry" | "fear" | "surprise" | "thinking"

export type Personality = "warm" | "analytical" | "playful" | "professional"

export type AIProvider = "openai" | "anthropic" | "google" | "webllm" | "ollama"

const envDefaultProvider = process.env.NEXT_PUBLIC_DEFAULT_PROVIDER
const defaultProvider: AIProvider =
  envDefaultProvider === "openai" ||
  envDefaultProvider === "anthropic" ||
  envDefaultProvider === "google" ||
  envDefaultProvider === "webllm" ||
  envDefaultProvider === "ollama"
    ? envDefaultProvider
    : "openai"

export interface FacialExpression {
  neutral: number
  happy: number
  sad: number
  angry: number
  fearful: number
  disgusted: number
  surprised: number
  detection: boolean
}

export interface LocationData {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  city: string | null
  country: string | null
  error: string | null
}

export interface Message {
  id: string
  text: string
  sender: "user" | "ai"
  timestamp: Date
  emotion?: Emotion
}

export interface EmpathyData {
  says: string[]
  thinks: string[]
  does: string[]
  feels: string[]
}

export interface EmpathyProfile {
  version: string
  preferredName: string
  communicationStyle: string
  supportGoals: string[]
  negativeThoughtPatterns: string[]
  reframePreferences: string[]
  groundingPrompts: string[]
  avoidPhrases: string[]
}

export const DEFAULT_EMPATHY_PROFILE: EmpathyProfile = {
  version: "1.0",
  preferredName: "Friend",
  communicationStyle: "Warm, validating, and practical.",
  supportGoals: [
    "Help me pause and rethink negative thoughts",
    "Guide me toward balanced interpretations",
    "Suggest small, realistic next steps",
  ],
  negativeThoughtPatterns: [
    "Catastrophizing",
    "All-or-nothing thinking",
    "Harsh self-criticism",
  ],
  reframePreferences: [
    "Name the thought pattern first",
    "Offer one compassionate alternative thought",
    "Suggest one concrete action I can do now",
  ],
  groundingPrompts: [
    "What evidence supports this thought?",
    "What would I say to a close friend in this situation?",
    "What is one balanced possibility I might be missing?",
  ],
  avoidPhrases: [
    "Just calm down",
    "You are overreacting",
  ],
}

function hashToBase36(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36).toUpperCase()
}

export function generateEmpathyCode(params: {
  profile: EmpathyProfile
  empathyData: EmpathyData
  introAnswers: string[]
}): string {
  const { profile, empathyData, introAnswers } = params

  const styleToken =
    profile.communicationStyle.toLowerCase().includes("direct") ||
    profile.communicationStyle.toLowerCase().includes("analytical")
      ? "RFLX"
      : profile.communicationStyle.toLowerCase().includes("play")
        ? "CRTV"
        : "WARM"

  const patternToken = profile.negativeThoughtPatterns.length
    ? profile.negativeThoughtPatterns[0].replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase() || "MIND"
    : "MIND"

  const summary = JSON.stringify({
    preferredName: profile.preferredName,
    supportGoals: profile.supportGoals,
    negativeThoughtPatterns: profile.negativeThoughtPatterns,
    reframePreferences: profile.reframePreferences,
    groundingPrompts: profile.groundingPrompts,
    empathyData,
    introAnswers,
  })

  const digest = hashToBase36(summary).slice(0, 6)
  return `EMP-${styleToken}-${patternToken}-${digest}`
}

export interface CompanionSettings {
  name: string
  personality: Personality
  provider: AIProvider
  temperature: number
  cameraDeviceId: string
  webllmModel: string
  ollamaBaseUrl: string
  ollamaModel: string
}

export const DEFAULT_SETTINGS: CompanionSettings = {
  name: "Samantha",
  personality: "warm",
  provider: defaultProvider,
  temperature: 0.7,
  cameraDeviceId: "",
  webllmModel: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "llama3.2",
}

export function detectEmotion(text: string): Emotion {
  const lower = text.toLowerCase()
  if (/happy|great|awesome|love|excited|joy|wonderful|amazing/.test(lower)) return "happy"
  if (/sad|depressed|lonely|terrible|miss|crying|hurt/.test(lower)) return "sad"
  if (/angry|furious|mad|rage|hate|annoying/.test(lower)) return "angry"
  if (/scared|afraid|anxious|worried|nervous|panic/.test(lower)) return "fear"
  if (/wow|surprised|unexpected|shocking|really\?/.test(lower)) return "surprise"
  if (/think|believe|wonder|suppose|maybe|perhaps/.test(lower)) return "thinking"
  return "neutral"
}

export function analyzeEmpathy(text: string, existing: EmpathyData): EmpathyData {
  const lower = text.toLowerCase()
  const copy = {
    says: [...existing.says],
    thinks: [...existing.thinks],
    does: [...existing.does],
    feels: [...existing.feels],
  }

  // SAYS - direct quotes
  if (text.length > 10) {
    copy.says.push(`"${text.substring(0, 60)}${text.length > 60 ? "..." : ""}"`)
  }

  // THINKS - beliefs and thoughts
  const thinkWords = ["think", "believe", "feel like", "suppose", "wonder", "doubt", "maybe", "perhaps"]
  if (thinkWords.some((w) => lower.includes(w))) {
    copy.thinks.push(text.substring(0, 55) + (text.length > 55 ? "..." : ""))
  }

  // DOES - action indicators
  const actionWords = ["did", "doing", "going", "went", "tried", "started", "finished", "working", "built", "made"]
  if (actionWords.some((w) => lower.includes(w))) {
    copy.does.push(text.substring(0, 55) + (text.length > 55 ? "..." : ""))
  }

  // FEELS - emotional signals
  const emotionWords = ["happy", "sad", "angry", "anxious", "excited", "worried", "scared", "proud", "grateful", "frustrated", "lonely", "overwhelmed"]
  const found = emotionWords.filter((w) => lower.includes(w))
  if (found.length > 0) {
    copy.feels.push(`${text.substring(0, 40)}... [${found.join(", ")}]`)
  }

  // Limit each to 6
  Object.keys(copy).forEach((key) => {
    const k = key as keyof EmpathyData
    if (copy[k].length > 6) copy[k] = copy[k].slice(-6)
  })

  return copy
}
