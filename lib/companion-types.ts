export type Emotion = "neutral" | "happy" | "sad" | "angry" | "fear" | "surprise" | "thinking"

export type Personality = "warm" | "analytical" | "playful" | "professional"

export type AIProvider = "openai" | "anthropic" | "google"

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

export interface CompanionSettings {
  name: string
  personality: Personality
  provider: AIProvider
  temperature: number
  cameraDeviceId: string
}

export const DEFAULT_SETTINGS: CompanionSettings = {
  name: "Samantha",
  personality: "warm",
  provider: "openai",
  temperature: 0.7,
  cameraDeviceId: "",
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
