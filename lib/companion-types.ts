export type Emotion = "neutral" | "happy" | "sad" | "angry" | "fear" | "surprise" | "thinking"

export type Personality = "warm" | "analytical" | "playful" | "professional"

export type ToneMode = "casual" | "balanced" | "deep"

export type AIProvider = "openai" | "anthropic" | "google" | "webllm" | "ollama" | "openrouter"

export const PROVIDER_DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-20241022",
  google: "gemini-2.0-flash-001",
} as const

const envDefaultProvider = process.env.NEXT_PUBLIC_DEFAULT_PROVIDER
const defaultProvider: AIProvider =
  envDefaultProvider === "openai" ||
  envDefaultProvider === "anthropic" ||
  envDefaultProvider === "google" ||
  envDefaultProvider === "webllm" ||
  envDefaultProvider === "ollama" ||
  envDefaultProvider === "openrouter"
    ? envDefaultProvider
    : "webllm"

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
  mode?: "fallback" | "mcp-fallback"
}

export interface EmpathyData {
  says: string[]
  thinks: string[]
  does: string[]
  feels: string[]
}

export interface EmpathyAnalysisResult {
  data: EmpathyData
  sentimentScore: number
}

export interface EmpathyMetaRecord {
  depth: number
  primaryQuadrant: "SAYS" | "THINKS" | "DOES" | "FEELS"
  sentimentPolarity: number
}

export interface HeuristicSummary {
  says: number
  thinks: number
  does: number
  feels: number
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

export function calculateResonance(sessionData: EmpathyData) {
  const density = {
    s: sessionData.says.length,
    t: sessionData.thinks.length,
    d: sessionData.does.length,
    f: sessionData.feels.length,
  }

  const syncScore = (density.t * density.f) / (density.s + 1)
  const dominant = (Object.keys(density) as Array<keyof typeof density>).reduce((a, b) =>
    density[a] >= density[b] ? a : b
  )

  return { density, syncScore, dominant }
}

export type ShadowArchetype = "PR" | "CH" | "VO"

function inferShadowArchetype(empathyData: EmpathyData): ShadowArchetype {
  const corpus = [...empathyData.thinks, ...empathyData.feels, ...empathyData.says, ...empathyData.does]
    .join(" ")
    .toLowerCase()

  if (/(protect|guard|unsafe|vulnerab|defend|threat)/.test(corpus)) return "PR"
  if (/(child|younger|small|abandon|alone|parents?)/.test(corpus)) return "CH"
  if (/(empty|void|numb|hollow|nothing|disconnected)/.test(corpus)) return "VO"

  return "PR"
}

function emotionPrefix(emotion: Emotion): string {
  const map: Record<Emotion, string> = {
    neutral: "NE",
    happy: "HA",
    sad: "SA",
    angry: "AG",
    fear: "AN",
    surprise: "SU",
    thinking: "TH",
  }
  return map[emotion]
}

export function generateEmpathyCode(params: {
  empathyData: EmpathyData
  metaData?: EmpathyMetaRecord[]
  sentimentScoreTotal?: number
  dominantEmotion?: Emotion
  shadowArchetype?: ShadowArchetype
  intensityScore?: number
}): { code: string; message: string; resonanceScore: number; emotionalVelocity: number } {
  const {
    empathyData,
    metaData = [],
    sentimentScoreTotal = 0,
    dominantEmotion = "neutral",
    shadowArchetype,
    intensityScore,
  } = params

  const resonance = calculateResonance(empathyData)

  const depthDelta =
    metaData.length > 1
      ? metaData.slice(1).reduce((acc, item, index) => acc + Math.abs(item.depth - metaData[index].depth), 0) / (metaData.length - 1)
      : 0
  const polarityStrength =
    metaData.length > 0
      ? metaData.reduce((acc, item) => acc + Math.abs(item.sentimentPolarity), 0) / metaData.length
      : Math.min(1, Math.abs(sentimentScoreTotal) / 8)
  const emotionalVelocity = Math.min(1, depthDelta / 4 + polarityStrength / 2)

  const resolvedArchetype = shadowArchetype || inferShadowArchetype(empathyData)
  const resolvedIntensity =
    intensityScore !== undefined
      ? Math.max(0, Math.min(99, Math.round(intensityScore)))
      : Math.max(10, Math.min(99, Math.round(emotionalVelocity * 100)))
  const code = `${emotionPrefix(dominantEmotion)}-${resolvedIntensity}-${resolvedArchetype}`

  const archetypeMeaning: Record<ShadowArchetype, string> = {
    PR: "Protector",
    CH: "Child",
    VO: "Void",
  }
  const message = `${dominantEmotion} intensity at ${resolvedIntensity} with ${archetypeMeaning[resolvedArchetype]} archetype pattern.`

  return {
    code,
    message,
    resonanceScore: resonance.syncScore,
    emotionalVelocity,
  }
}

export interface CompanionSettings {
  name: string
  personality: Personality
  toneMode: ToneMode
  provider: AIProvider
  temperature: number
  topP: number
  maxOutputTokens: number
  contextMessages: number
  cameraDeviceId: string
  webllmModel: string
  ollamaBaseUrl: string
  ollamaModel: string
  mcpBaseUrl: string
  mcpModel: string
  mcpApiKey: string
  mcpAutoFallback: boolean
  openRouterApiKey: string
  openRouterModel: string
}

export const DEFAULT_SETTINGS: CompanionSettings = {
  name: "Samantha",
  personality: "warm",
  toneMode: "balanced",
  provider: defaultProvider,
  temperature: 0.7,
  topP: 0.95,
  maxOutputTokens: 300,
  contextMessages: 12,
  cameraDeviceId: "",
  webllmModel: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "llama3.2",
  mcpBaseUrl: "http://127.0.0.1:8787",
  mcpModel: "gpt-4o-mini",
  mcpApiKey: "",
  mcpAutoFallback: false,
  openRouterApiKey: "",
  openRouterModel: "qwen/qwen3-4b:free",
}

export function detectEmotion(text: string): Emotion {
  const lower = text.toLowerCase()
  if (/happy|great|awesome|love|excited|joy|wonderful|amazing/.test(lower)) return "happy"
  if (/sad|depressed|lonely|terrible|miss|crying|hurt|wrong|not true|incorrect/.test(lower)) return "sad"
  if (/angry|furious|mad|rage|hate|annoying|doesn't work|doesnt work|not working|frustrat/.test(lower)) return "angry"
  if (/scared|afraid|anxious|worried|nervous|panic/.test(lower)) return "fear"
  if (/wow|surprised|unexpected|shocking|really\?/.test(lower)) return "surprise"
  if (/think|believe|wonder|suppose|maybe|perhaps/.test(lower)) return "thinking"
  return "neutral"
}

const positiveLexicon = [
  "good",
  "great",
  "better",
  "calm",
  "hope",
  "progress",
  "grateful",
  "relief",
  "proud",
  "confident",
  "joy",
  "happy",
  "safe",
]

const negativeLexicon = [
  "no",
  "nope",
  "nah",
  "wrong",
  "incorrect",
  "not",
  "don't",
  "cant",
  "can't",
  "bad",
  "worse",
  "stuck",
  "panic",
  "anxious",
  "afraid",
  "hopeless",
  "failure",
  "worthless",
  "overwhelmed",
  "angry",
  "sad",
  "lonely",
  "terrible",
]

export function estimateSentimentScore(text: string): number {
  const lower = text.toLowerCase()
  let score = 0

  positiveLexicon.forEach((word) => {
    if (lower.includes(word)) score += 1
  })

  negativeLexicon.forEach((word) => {
    if (lower.includes(word)) score -= 1
  })

  return score
}

export function sentimentIntensity(text: string): number {
  const score = Math.abs(estimateSentimentScore(text))
  return Math.min(1, score / 4)
}

export function analyzeHeuristics(text: string): HeuristicSummary {
  const input = text.toLowerCase()
  const summary: HeuristicSummary = { says: 0, thinks: 0, does: 0, feels: 0 }

  // SAYS: Direct quotes or reported speech.
  if (input.includes('"') || /\b(told|said|spoke|shared)\b/.test(input)) {
    summary.says = 1
  }

  // THINKS: Internal processing and beliefs.
  if (/\b(think|believe|wonder|maybe|assume|opinion|realized)\b/.test(input)) {
    summary.thinks = 1
  }

  // DOES: Physical actions and behaviors.
  if (/\b(did|went|tried|using|bought|avoid|habit|started)\b/.test(input)) {
    summary.does = 1
  }

  // FEELS: Emotional intensity keywords.
  if (/\b(scared|happy|angry|frustrated|tired|anxious|sad|love|hate)\b/.test(input)) {
    summary.feels = 1
  }

  return summary
}

export function analyzeEmpathy(text: string, existing: EmpathyData): EmpathyAnalysisResult {
  const lower = text.toLowerCase()
  const sentimentScore = estimateSentimentScore(text)
  const intensity = sentimentIntensity(text)
  const heuristic = analyzeHeuristics(text)
  const copy = {
    says: [...existing.says],
    thinks: [...existing.thinks],
    does: [...existing.does],
    feels: [...existing.feels],
  }

  const clip = (value: string, length: number) => `${value.substring(0, length)}${value.length > length ? "..." : ""}`

  // SAYS - quotation extraction and dialogue markers
  if (heuristic.says) {
    const quotedChunks = [...text.matchAll(/"([^"]+)"/g)].map((match) => match[1])
    quotedChunks.forEach((chunk) => {
      if (chunk.trim()) {
        copy.says.push(`"${clip(chunk.trim(), 60)}"`)
      }
    })
    if (/(i told|they mentioned|i said|they said|he said|she said)/.test(lower)) {
      copy.says.push(`Reported dialogue: ${clip(text, 55)}`)
    }
  }

  // THINKS - internal monologue and uncertainty patterns
  if (heuristic.thinks || /(i'm worried that|what if|perhaps)/.test(lower)) {
    copy.thinks.push(`Belief: ${clip(text, 55)}`)
  }

  // DOES - physical/behavioral action indicators
  if (heuristic.does || /(i am currently|i went to|i'm typing|i started)/.test(lower)) {
    copy.does.push(`Action: ${clip(text, 55)}`)
  }

  // FEELS - emotion phrases and sentiment intensity threshold
  const emotionWords = ["happy", "sad", "angry", "anxious", "excited", "worried", "scared", "proud", "grateful", "frustrated", "lonely", "overwhelmed"]
  const found = emotionWords.filter((w) => lower.includes(w))
  if (found.length > 0 || heuristic.feels) {
    copy.feels.push(`${clip(text, 40)} [${found.join(", ")}]`)
  }
  if (/(i am|i'm|i feel|it's hard|it is hard)/.test(lower)) {
    copy.feels.push(`Emotion statement: ${clip(text, 55)}`)
  }
  if (intensity > 0.5 && sentimentScore < 0) {
    copy.feels.push("Sentiment: Negative/Stressed")
  }
  if (intensity > 0.5 && sentimentScore > 0) {
    copy.feels.push("Sentiment: Positive/Engaged")
  }

  // Limit each to 6
  Object.keys(copy).forEach((key) => {
    const k = key as keyof EmpathyData
    if (copy[k].length > 6) copy[k] = copy[k].slice(-6)
  })

  return {
    data: copy,
    sentimentScore,
  }
}
