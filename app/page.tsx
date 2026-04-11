"use client"

import { useState, useCallback, useMemo, useEffect, useRef, type Dispatch, type SetStateAction } from "react"
import dynamic from "next/dynamic"
import { useChat } from "@ai-sdk/react"
import { Settings } from "lucide-react"
import { ChatPanel } from "@/components/chat-panel"
import {
  DEFAULT_SETTINGS,
  DEFAULT_EMPATHY_PROFILE,
  PROVIDER_DEFAULT_MODELS,
  detectEmotion,
  analyzeEmpathy,
  estimateSentimentScore,
  sentimentIntensity,
  generateEmpathyCode,
  type Emotion,
  type EmpathyData,
  type EmpathyMetaRecord,
  type EmpathyProfile,
  type CompanionSettings,
  type Message,
} from "@/lib/companion-types"
import {
  articulateQuestion as articulateQuestionFromEngine,
  buildUserUnderstandingGuidance,
  buildClarificationPrompt,
  buildEmpathySystemPrompt,
  inferUserUnderstanding,
  buildHumanCheckInReply as buildHumanCheckInReplyFromEngine,
  buildLocalCompanionReply as buildLocalCompanionReplyFromEngine,
  ensureNonRepeatingFallback as ensureNonRepeatingFallbackFromEngine,
  getToneModeInstruction as getToneModeInstructionFromEngine,
  needsClarificationForAnswer,
} from "@/lib/conversation/communication-engine"

const CameraPanel = dynamic(() => import("@/components/camera-panel").then((mod) => mod.CameraPanel), {
  ssr: false,
})

const EmpathyPanel = dynamic(() => import("@/components/empathy-panel").then((mod) => mod.EmpathyPanel), {
  ssr: false,
})

const SettingsPanel = dynamic(() => import("@/components/settings-panel").then((mod) => mod.SettingsPanel), {
  ssr: false,
})

const SetupChecklist = dynamic(() => import("@/components/setup-checklist").then((mod) => mod.SetupChecklist), {
  ssr: false,
})

function applyDataUpdateBlock(existing: EmpathyData, update: Partial<Record<keyof EmpathyData, string>>): EmpathyData {
  const next: EmpathyData = {
    says: [...existing.says],
    thinks: [...existing.thinks],
    does: [...existing.does],
    feels: [...existing.feels],
  }

  ;(["says", "thinks", "does", "feels"] as const).forEach((key) => {
    const value = update[key]
    if (typeof value === "string" && value.trim().length > 0) {
      next[key].push(value.trim())
      if (next[key].length > 6) next[key] = next[key].slice(-6)
    }
  })

  return next
}

function extractDataUpdate(text: string): { cleanText: string; update?: Partial<Record<keyof EmpathyData, string>> } {
  const match = text.match(/\[EMPATHY_DATA:\s*(\{[\s\S]*?\})\s*\]/)
  if (!match) {
    return { cleanText: text }
  }

  let parsed: Partial<Record<keyof EmpathyData, string>> | undefined
  try {
    parsed = JSON.parse(match[1])
  } catch {
    parsed = undefined
  }

  const cleanText = text.replace(match[0], "").trim()
  return { cleanText, update: parsed }
}

function extractMetaBlock(text: string): {
  cleanText: string
  meta?: { depth: number; primaryQuadrant: "SAYS" | "THINKS" | "DOES" | "FEELS"; sentimentPolarity: number }
} {
  const match = text.match(/\[META:\s*(\{[\s\S]*?\})\s*\]/)
  if (!match) {
    return { cleanText: text }
  }

  let meta:
    | { depth: number; primaryQuadrant: "SAYS" | "THINKS" | "DOES" | "FEELS"; sentimentPolarity: number }
    | undefined

  try {
    const parsed = JSON.parse(match[1])
    const depth = Number(parsed.depth_level)
    const primary = String(parsed.primary_quadrant || "THINKS").toUpperCase()
    const polarity = Number(parsed.sentiment_polarity)
    if (["SAYS", "THINKS", "DOES", "FEELS"].includes(primary)) {
      meta = {
        depth: Number.isFinite(depth) ? Math.max(1, Math.min(10, depth)) : 1,
        primaryQuadrant: primary as "SAYS" | "THINKS" | "DOES" | "FEELS",
        sentimentPolarity: Number.isFinite(polarity) ? Math.max(-1, Math.min(1, polarity)) : 0,
      }
    }
  } catch {
    meta = undefined
  }

  const cleanText = text.replace(match[0], "").trim()
  return { cleanText, meta }
}

function applyMetaSignal(
  meta: { depth: number; primaryQuadrant: "SAYS" | "THINKS" | "DOES" | "FEELS"; sentimentPolarity: number } | undefined,
  setSessionDepthLevel: Dispatch<SetStateAction<number>>,
  setCurrentStep: Dispatch<SetStateAction<number>>,
  setConversationSentimentScore: Dispatch<SetStateAction<number>>
) {
  if (!meta) return

  setSessionDepthLevel((prev) => Math.max(prev, meta.depth))
  setCurrentStep((prev) => Math.max(prev, Math.min(EMPATHY_QUEST_BANK.length - 1, meta.depth - 1)))
  setConversationSentimentScore((prev) => prev + meta.sentimentPolarity)
}

type EmpathyQuestion = {
  id: string
  question: string
  category: "SAYS" | "THINKS" | "DOES" | "FEELS"
  followUp: string
  uiSection: string
  anchor?: string
}

type DepthTierId = "tier_1_surface" | "tier_2_internal" | "tier_3_social" | "tier_4_shadow"

const DEEP_DISCOVERY_MATRIX: Record<DepthTierId, Array<{ id: string; q: string; cat: EmpathyQuestion["category"]; anchor?: string }>> = {
  tier_1_surface: [
    {
      id: "surface_checkin",
      q: "How are you feeling today?",
      cat: "FEELS",
    },
    {
      id: "surface_trigger",
      q: "What was the specific external event that pulled you out of your flow?",
      cat: "DOES",
    },
    {
      id: "surface_body",
      q: "What changed in your body right after that event?",
      cat: "FEELS",
    },
  ],
  tier_2_internal: [
    {
      id: "internal_script",
      q: "What is the internal script that starts playing the second that trigger happens?",
      cat: "THINKS",
    },
    {
      id: "internal_prediction",
      q: "What are you predicting will happen if this keeps repeating?",
      cat: "THINKS",
    },
  ],
  tier_3_social: [
    {
      id: "social_mask",
      q: "If you were explaining this to someone you don't trust, how would you change the story?",
      cat: "SAYS",
    },
    {
      id: "social_performance",
      q: "What version of you shows up in public when this pain is active?",
      cat: "SAYS",
    },
  ],
  tier_4_shadow: [
    {
      id: "Q-S1",
      q: "If this feeling were a protector, what is it terrified would happen if it let its guard down?",
      cat: "THINKS",
      anchor: "Fear of Vulnerability",
    },
    {
      id: "Q-S2",
      q: "What is the one thing you are currently doing that is a direct apology for a mistake you never made?",
      cat: "DOES",
      anchor: "Unconscious Guilt",
    },
    {
      id: "Q-S3",
      q: "Which part of this story are you omitting so that you can remain the hero in this narrative?",
      cat: "SAYS",
      anchor: "Narrative Bias",
    },
    {
      id: "Q-S4",
      q: "If your body were an empty house, which room is this emotion currently hiding in?",
      cat: "FEELS",
      anchor: "Somatic Rooting",
    },
  ],
}

const DEPTH_TIER_ORDER: DepthTierId[] = ["tier_1_surface", "tier_2_internal", "tier_3_social", "tier_4_shadow"]

const DEPTH_TIER_LABELS: Record<DepthTierId, string> = {
  tier_1_surface: "I: The Surface",
  tier_2_internal: "II: The Internal",
  tier_3_social: "III: The Social",
  tier_4_shadow: "IV: The Shadow",
}

const DEPTH_TIER_THRESHOLDS = {
  tier_2_internal: { words: 28, intensity: 0.2 },
  tier_3_social: { words: 54, intensity: 0.35 },
  tier_4_shadow: { words: 80, intensity: 0.5 },
}

const EMPATHY_QUEST_BANK: EmpathyQuestion[] = [
  ...DEEP_DISCOVERY_MATRIX.tier_1_surface.map((item) => ({
    id: item.id,
    question: item.q,
    category: item.cat,
    followUp: "And what does that tell you about your first coping move?",
    uiSection: DEPTH_TIER_LABELS.tier_1_surface,
  })),
  ...DEEP_DISCOVERY_MATRIX.tier_2_internal.map((item) => ({
    id: item.id,
    question: item.q,
    category: item.cat,
    followUp: "And what does that tell you about the belief beneath that story?",
    uiSection: DEPTH_TIER_LABELS.tier_2_internal,
  })),
  ...DEEP_DISCOVERY_MATRIX.tier_3_social.map((item) => ({
    id: item.id,
    question: item.q,
    category: item.cat,
    followUp: "You said that out loud, but what did you feel immediately after saying it?",
    uiSection: DEPTH_TIER_LABELS.tier_3_social,
  })),
  ...DEEP_DISCOVERY_MATRIX.tier_4_shadow.map((item) => ({
    id: item.id,
    question: item.q,
    category: item.cat,
    followUp: "And if you dig just an inch deeper, what is underneath that?",
    uiSection: DEPTH_TIER_LABELS.tier_4_shadow,
    anchor: item.anchor,
  })),
]

const INTRO_CHAT_QUESTIONS = EMPATHY_QUEST_BANK.filter(
  (item) => item.uiSection === DEPTH_TIER_LABELS.tier_1_surface
)

const HOW_ARE_YOU_PATTERN = /\b(how are you|how're you|how r u|how are u|how you doing|how is it going)\b/i

function buildHumanCheckInReply(name: string, personality: CompanionSettings["personality"]) {
  return buildHumanCheckInReplyFromEngine(name, personality)
}

function buildLocalCompanionReply(input: string, sentimentScore: number, suggestedQuestion: string) {
  return buildLocalCompanionReplyFromEngine(input, sentimentScore, suggestedQuestion)
}

function ensureNonRepeatingFallback(nextText: string, previousText: string, suggestedQuestion: string) {
  return ensureNonRepeatingFallbackFromEngine(nextText, previousText, suggestedQuestion)
}

function articulateQuestion(input: string) {
  return articulateQuestionFromEngine(input)
}

function toOpenEndedPrompt(input: string) {
  const base = articulateQuestion(input).replace(/[?]+$/, "").trim()
  if (!base) return "When you're ready, share what feels most important right now."
  return `When you're ready, share ${base.charAt(0).toLowerCase()}${base.slice(1)}.`
}

function buildAnswerAdaptivePrompt(answer: string, fallbackPrompt: string) {
  const normalized = answer.replace(/\s+/g, " ").trim()
  if (!normalized) return toOpenEndedPrompt(fallbackPrompt)

  const words = normalized.split(/\s+/).filter(Boolean)
  const clipped = words.slice(0, 10).join(" ")
  return `I hear "${clipped}${words.length > 10 ? "..." : ""}". When you're ready, go one layer deeper into what matters most in that.`
}

function getToneModeInstruction(toneMode: CompanionSettings["toneMode"]) {
  return getToneModeInstructionFromEngine(toneMode)
}

type QuickPresetId = "fast-local" | "balanced-cloud" | "deep-empathy"

function withQuickPreset(base: CompanionSettings, presetId: QuickPresetId): CompanionSettings {
  if (presetId === "fast-local") {
    return {
      ...base,
      provider: "webllm",
      webllmModel: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
      toneMode: "casual",
      personality: "warm",
      temperature: 0.7,
      maxOutputTokens: 220,
      mcpAutoFallback: true,
    }
  }

  if (presetId === "balanced-cloud") {
    return {
      ...base,
      provider: "openrouter",
      openRouterModel: "qwen/qwen3-4b:free",
      toneMode: "balanced",
      personality: "warm",
      temperature: 0.6,
      maxOutputTokens: 260,
      mcpAutoFallback: true,
    }
  }

  return {
    ...base,
    provider: "openrouter",
    openRouterModel: "meta-llama/llama-3.3-70b-instruct:free",
    toneMode: "deep",
    personality: "analytical",
    temperature: 0.7,
    maxOutputTokens: 320,
    mcpAutoFallback: true,
  }
}

const WEBLLM_MODEL_REPO_MAP: Record<string, string> = {
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC": "https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/resolve/main/",
  "Llama-3.2-3B-Instruct-q4f16_1-MLC": "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC/resolve/main/",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC": "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/",
  "gemma-2-2b-it-q4f16_1-MLC": "https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC/resolve/main/",
  "Mistral-7B-Instruct-v0.3-q4f16_1-MLC": "https://huggingface.co/mlc-ai/Mistral-7B-Instruct-v0.3-q4f16_1-MLC/resolve/main/",
}

function getDeepestPossibleQuestion(fullSessionData: EmpathyData) {
  const categories: Array<keyof EmpathyData> = ["says", "thinks", "does", "feels"]
  const weakestLink = categories.reduce((a, b) =>
    fullSessionData[a].length <= fullSessionData[b].length ? a : b
  )

  const shadowOptions: Record<keyof EmpathyData, string> = {
    thinks: "What is the secret thought you have that you're afraid is actually true?",
    feels: "If this pain were a sound, would it be a scream or a whisper? Why?",
    does: "What habit are you using to punish yourself right now?",
    says: "What would you say if you knew you couldn't be judged by anyone?",
  }

  return shadowOptions[weakestLink]
}

function countWords(entries: string[]) {
  return entries.reduce((sum, entry) => {
    const words = entry.trim().split(/\s+/).filter(Boolean).length
    return sum + words
  }, 0)
}

function getCurrentDepthTier(
  data: EmpathyData,
  sentimentScoreTotal: number,
  sessionDepth: number,
  metaDepth: number
): { tier: DepthTierId; unlockedIndex: number; wordDensity: number; sentimentIntensity: number } {
  const wordDensity = countWords(data.says) + countWords(data.thinks) + countWords(data.does) + countWords(data.feels)
  const sentimentIntensity = Math.min(1, Math.abs(sentimentScoreTotal) / Math.max(1, sessionDepth))

  let unlockedIndex = 0
  if (
    wordDensity >= DEPTH_TIER_THRESHOLDS.tier_2_internal.words &&
    sentimentIntensity >= DEPTH_TIER_THRESHOLDS.tier_2_internal.intensity
  ) {
    unlockedIndex = 1
  }
  if (
    wordDensity >= DEPTH_TIER_THRESHOLDS.tier_3_social.words &&
    sentimentIntensity >= DEPTH_TIER_THRESHOLDS.tier_3_social.intensity
  ) {
    unlockedIndex = 2
  }
  if (
    wordDensity >= DEPTH_TIER_THRESHOLDS.tier_4_shadow.words &&
    sentimentIntensity >= DEPTH_TIER_THRESHOLDS.tier_4_shadow.intensity
  ) {
    unlockedIndex = 3
  }

  const depthBoost = Math.max(0, Math.floor((metaDepth - 1) / 3))
  unlockedIndex = Math.min(3, Math.max(unlockedIndex, depthBoost))

  return {
    tier: DEPTH_TIER_ORDER[unlockedIndex],
    unlockedIndex,
    wordDensity,
    sentimentIntensity,
  }
}

function getLowestQuadrant(currentSummary: { says: number; thinks: number; does: number; feels: number }) {
  return (Object.keys(currentSummary) as Array<keyof typeof currentSummary>).reduce((a, b) =>
    currentSummary[a] <= currentSummary[b] ? a : b
  )
}

function getDeepPrompt(
  userData: { says: number; thinks: number; does: number; feels: number },
  sessionDepth: number,
  tier: DepthTierId,
  emotionalVelocity: number
) {
  const intensity = tier === "tier_4_shadow" ? "Provocative" : tier === "tier_3_social" ? "Reflective" : "Inquisitive"
  const lowestQuadrant = getLowestQuadrant(userData)

  return `User current intensity is ${intensity}. Emotional velocity is ${emotionalVelocity.toFixed(2)}.
You are the Mirror for the user.
- Identify Dissonance: If SAYS suggests "fine" while FEELS/DOES suggests distress, explicitly name the gap in one sentence.
- Chain of Why: Use 5 Whys style probing while pivoting quadrants (SAYS -> THINKS -> DOES -> FEELS).
- Silent Prompt: For short answers, give a brief warm pause validation, then ask: "And if you dig just an inch deeper, what's underneath that?"
- Do not provide solutions. Use vertical probing and ask one follow-up that targets ${lowestQuadrant.toUpperCase()}.
Current tier: ${DEPTH_TIER_LABELS[tier]}.`
}

function getNextDeepQuestion(
  summary: { says: number; thinks: number; does: number; feels: number },
  activeTier: DepthTierId,
  lastUserAnswer?: string
) {
  const evidenceCount = summary.says + summary.thinks + summary.does + summary.feels
  const targetQuadrant = getLowestQuadrant(summary)
  const normalizedLastAnswer = (lastUserAnswer || "").trim()
  const answerWordCount = normalizedLastAnswer.length > 0
    ? normalizedLastAnswer.split(/\s+/).filter(Boolean).length
    : 0

  // Keep early turns simple so the user can settle into the conversation.
  if (evidenceCount <= 1) {
    return {
      question: "How are you feeling today?",
      tier: "tier_1_surface" as const,
      targetQuadrant: "FEELS",
    }
  }

  if (evidenceCount <= 3 || answerWordCount > 0 && answerWordCount <= 6) {
    return {
      question: toOpenEndedPrompt("What feels most present for you right now"),
      tier: "tier_1_surface" as const,
      targetQuadrant: "FEELS",
    }
  }

  const potentialQuestions = DEEP_DISCOVERY_MATRIX[activeTier].filter((item) => item.cat.toLowerCase() === targetQuadrant)
  const questionPool = potentialQuestions.length > 0 ? potentialQuestions : DEEP_DISCOVERY_MATRIX[activeTier]
  const progressionSeed = summary.says + summary.thinks * 2 + summary.does * 3 + summary.feels * 5
  const selected = questionPool[progressionSeed % questionPool.length]

  return {
    question: lastUserAnswer
      ? buildAnswerAdaptivePrompt(lastUserAnswer, selected?.q || "Tell me more about what you're thinking right now")
      : toOpenEndedPrompt(selected?.q || "Tell me more about what you're thinking right now"),
    tier: activeTier,
    targetQuadrant: targetQuadrant.toUpperCase(),
  }
}

function buildSystemPrompt(
  companionName: string,
  personality: CompanionSettings["personality"],
  toneMode: CompanionSettings["toneMode"],
  emotion: Emotion,
  empathyProfile: EmpathyProfile,
  empathyCode: string,
  samanthaGuidance: string,
  userText: string
) {
  return buildEmpathySystemPrompt({
    companionName,
    personality,
    toneMode,
    emotion,
    empathyProfile,
    empathyCode,
    samanthaGuidance,
    userUnderstandingGuidance: buildUserUnderstandingGuidance(userText),
  })
}

export default function CompanionApp() {
  const agreementStorageKey = "empatheia_user_agreement_v1"
  const quickPresetStorageKey = "empatheia_quick_preset_v1"
  const chatApi = process.env.NEXT_PUBLIC_CHAT_API_URL || "/api/chat"

  const [settings, setSettings] = useState<CompanionSettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [cameraEmotion, setCameraEmotion] = useState<Emotion>("neutral")
  const [empathyData, setEmpathyData] = useState<EmpathyData>({
    says: [],
    thinks: [],
    does: [],
    feels: [],
  })
  const [onboardingSummary, setOnboardingSummary] = useState({ says: 0, thinks: 0, does: 0, feels: 0 })
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>("neutral")
  const [empathyProfile, setEmpathyProfile] = useState<EmpathyProfile>(DEFAULT_EMPATHY_PROFILE)
  const [, setCurrentStep] = useState(0)
  const [sessionDepthLevel, setSessionDepthLevel] = useState(1)
  const [metaHistory, setMetaHistory] = useState<EmpathyMetaRecord[]>([])
  const [introAnswers, setIntroAnswers] = useState<string[]>(Array(EMPATHY_QUEST_BANK.length).fill(""))
  const [onboardingChatMessages, setOnboardingChatMessages] = useState<Message[]>([])
  const [remoteFallbackMessages, setRemoteFallbackMessages] = useState<Message[]>([])
  const [empathyCode, setEmpathyCode] = useState("")
  const [conversationSentimentScore, setConversationSentimentScore] = useState(0)
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [mobilePanel, setMobilePanel] = useState<"camera" | "chat" | "empathy">("chat")
  const [rightPanelWidth, setRightPanelWidth] = useState(320)
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false)
  const [hasAgreed, setHasAgreed] = useState(false)
  const [showQuickStartModal, setShowQuickStartModal] = useState(false)
  const [agreementChecked, setAgreementChecked] = useState(false)
  const [errorSummaryCopiedAt, setErrorSummaryCopiedAt] = useState<number | null>(null)
  const [webLlmMessages, setWebLlmMessages] = useState<Message[]>([])
  const [isWebLlmLoading, setIsWebLlmLoading] = useState(false)
  const [isInitializingWebLlm, setIsInitializingWebLlm] = useState(false)
  const [webLlmStatus, setWebLlmStatus] = useState("idle")
  const [webLlmProgress, setWebLlmProgress] = useState("")
  const [webLlmError, setWebLlmError] = useState("")
  const [webLlmXpStage, setWebLlmXpStage] = useState<"idle" | "echo-sync" | "shadow-prefetch" | "shadow-unlocked">("idle")
  const [shadowPrefetchProgress, setShadowPrefetchProgress] = useState("")
  const [llmConnectionError, setLlmConnectionError] = useState("")

  const webLlmMessagesRef = useRef<Message[]>([])
  const empathyDataRef = useRef<EmpathyData>({
    says: [],
    thinks: [],
    does: [],
    feels: [],
  })
  const processedRemoteUpdateIdsRef = useRef<Set<string>>(new Set())
  const webLlmEngineRef = useRef<any>(null)
  const webLlmInitPromiseRef = useRef<Promise<any> | null>(null)
  const shadowPrefetchStartedRef = useRef(false)
  const shadowPrefetchPromiseRef = useRef<Promise<void> | null>(null)
  const introCountedRef = useRef<Set<number>>(new Set())
  const fallbackPhase2InjectedRef = useRef(false)
  const lastFallbackReplyRef = useRef("")

  useEffect(() => {
    if (typeof window === "undefined") return
    const agreed = window.localStorage.getItem(agreementStorageKey) === "accepted"
    setHasAgreed(agreed)

    if (!agreed) return

    const savedPreset = window.localStorage.getItem(quickPresetStorageKey)
    if (savedPreset === "fast-local" || savedPreset === "balanced-cloud" || savedPreset === "deep-empathy") {
      setSettings((prev) => withQuickPreset(prev, savedPreset))
      setShowQuickStartModal(false)
      return
    }

    if (savedPreset === "default") {
      setShowQuickStartModal(false)
      return
    }

    setShowQuickStartModal(true)
  }, [agreementStorageKey, quickPresetStorageKey])

  const handleChooseQuickPreset = useCallback(
    (preset: QuickPresetId | "default") => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(quickPresetStorageKey, preset)
      }

      if (preset !== "default") {
        setSettings((prev) => withQuickPreset(prev, preset))
      }

      setShowQuickStartModal(false)
    },
    [quickPresetStorageKey]
  )

  useEffect(() => {
    webLlmMessagesRef.current = webLlmMessages
  }, [webLlmMessages])

  useEffect(() => {
    empathyDataRef.current = empathyData
  }, [empathyData])

  useEffect(() => {
    if (!sessionStartedAt) return

    const updateElapsed = () => setElapsedMs(Date.now() - sessionStartedAt)
    updateElapsed()
    const intervalId = window.setInterval(updateElapsed, 15000)

    return () => window.clearInterval(intervalId)
  }, [sessionStartedAt])

  useEffect(() => {
    webLlmEngineRef.current = null
    webLlmInitPromiseRef.current = null
    setWebLlmStatus("idle")
    setWebLlmProgress("")
    setWebLlmError("")
    setWebLlmXpStage(settings.webllmModel === "Llama-3.2-3B-Instruct-q4f16_1-MLC" ? "shadow-unlocked" : "idle")
    setShadowPrefetchProgress("")
    shadowPrefetchStartedRef.current = false
    shadowPrefetchPromiseRef.current = null
    setLlmConnectionError("")
  }, [settings.webllmModel])

  const currentSummary = useMemo(
    () => ({
      says: empathyData.says.length + onboardingSummary.says,
      thinks: empathyData.thinks.length + onboardingSummary.thinks,
      does: empathyData.does.length + onboardingSummary.does,
      feels: empathyData.feels.length + onboardingSummary.feels,
    }),
    [empathyData, onboardingSummary]
  )

  const preflightDepth = Math.max(1, currentSummary.says + currentSummary.thinks + currentSummary.does + currentSummary.feels)
  const preflightTier = getCurrentDepthTier(empathyData, conversationSentimentScore, preflightDepth, sessionDepthLevel)
  const preflightVelocity = Math.min(1, Math.abs(conversationSentimentScore) / preflightDepth)
  const preflightQuestion = getNextDeepQuestion(currentSummary, preflightTier.tier)

  const { messages: chatMessages, sendMessage, status, error: remoteError } = useChat(({
    api: chatApi,
    body: {
      emotion: currentEmotion,
      personality: settings.personality,
      toneMode: settings.toneMode,
      provider: settings.provider,
      temperature: settings.temperature,
      companionName: settings.name,
      empathyProfile,
      empathyCode,
      ollamaBaseUrl: settings.ollamaBaseUrl,
      ollamaModel: settings.ollamaModel,
      openRouterApiKey: process.env.NODE_ENV === "production" ? "" : settings.openRouterApiKey,
      openRouterModel: settings.openRouterModel,
      topP: settings.topP,
      maxOutputTokens: settings.maxOutputTokens,
      contextMessages: settings.contextMessages,
      empathySummary: currentSummary,
      samanthaGuidance: getDeepPrompt(
        currentSummary,
        preflightDepth,
        preflightTier.tier,
        preflightVelocity
      ),
      nextDeepQuestion: preflightQuestion.question,
    },
  }) as any)

  const isRemoteLoading = status === "streaming" || status === "submitted"
  const isLoading = settings.provider === "webllm" ? isWebLlmLoading : isRemoteLoading
  const hasLocalFallbackActive =
    settings.provider === "webllm"
      ? Boolean(llmConnectionError) || webLlmStatus === "error"
      : Boolean(llmConnectionError)
  const systemHealth = hasLocalFallbackActive
    ? "fallback"
    : isLoading || (settings.provider === "webllm" && (webLlmStatus === "downloading" || webLlmStatus === "thinking"))
      ? "busy"
      : settings.provider === "webllm" && webLlmStatus !== "ready"
        ? "initializing"
        : "ready"
  const isColdFallbackMode =
    settings.provider === "webllm" && (webLlmStatus === "error" || Boolean(webLlmError) || Boolean(llmConnectionError))
  const elapsedMinutes = elapsedMs / 60000
  const fallbackPhase = !isColdFallbackMode ? 0 : elapsedMinutes < 2 ? 1 : elapsedMinutes < 5 ? 2 : 3

  useEffect(() => {
    if (remoteError?.message) {
      setLlmConnectionError(remoteError.message)
    }
  }, [remoteError])

  useEffect(() => {
    if (!isResizingRightPanel) return

    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = window.innerWidth - event.clientX
      const clamped = Math.max(280, Math.min(560, nextWidth))
      setRightPanelWidth(clamped)
    }

    const handleMouseUp = () => {
      setIsResizingRightPanel(false)
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizingRightPanel])

  useEffect(() => {
    if (settings.provider === "webllm") return

    // Clear stale local-runtime diagnostics so cloud providers are not marked fallback
    // by previous WebGPU/WebLLM failures.
    webLlmEngineRef.current = null
    webLlmInitPromiseRef.current = null
    setWebLlmStatus("idle")
    setWebLlmProgress("")
    setWebLlmError("")
    setWebLlmXpStage("idle")
    setShadowPrefetchProgress("")
    shadowPrefetchStartedRef.current = false
    shadowPrefetchPromiseRef.current = null

    // Clear previous connection error only when it came from local runtime.
    setLlmConnectionError((prev) => {
      if (!prev) return ""
      const lower = prev.toLowerCase()
      if (
        lower.includes("webgpu") ||
        lower.includes("adapter") ||
        lower.includes("device creation") ||
        lower.includes("webllm")
      ) {
        return ""
      }
      return prev
    })
  }, [settings.provider])

  const createWorkerEngine = useCallback(
    async (
      selectedModel: string,
      onProgress: (report: { progress?: number; text?: string }) => void
    ) => {
      const webllm = await import("@mlc-ai/web-llm")
      const worker = new Worker(new URL("./webllm-worker.ts", import.meta.url), { type: "module" })
      const selectedRepoUrl = WEBLLM_MODEL_REPO_MAP[selectedModel]

      const engineConfig = {
        initProgressCallback(report: { progress?: number; text?: string }) {
          onProgress(report)
        },
        ...(selectedRepoUrl
          ? {
              model_list: [
                {
                  model_url: selectedRepoUrl,
                  local_id: selectedModel,
                },
              ],
            }
          : {}),
      }

      try {
        const engine = await webllm.CreateWebWorkerMLCEngine(worker, selectedModel, engineConfig)
        return { engine, worker }
      } catch {
        worker.terminate()
        // Fallback for environments where worker initialization is blocked.
        const engine = await webllm.CreateMLCEngine(selectedModel, engineConfig)
        return { engine, worker: null as Worker | null }
      }
    },
    []
  )

  const diagnoseWebGpuSupport = useCallback(async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    if (typeof navigator === "undefined" || typeof window === "undefined") {
      return { ok: false, message: "WebLLM can only run in a browser window." }
    }

    if (!window.isSecureContext) {
      return {
        ok: false,
        message: "WebGPU requires a secure context. Use https:// or localhost (avoid plain LAN http://).",
      }
    }

    const nav = navigator as Navigator & {
      gpu?: {
        requestAdapter: (options?: unknown) => Promise<any>
      }
    }

    if (!nav.gpu) {
      return {
        ok: false,
        message: "WebGPU API is not available in this browser/profile. Try latest Chrome/Edge/Firefox with GPU acceleration enabled.",
      }
    }

    try {
      const adapter = await nav.gpu.requestAdapter({ powerPreference: "high-performance" })
      if (!adapter) {
        return {
          ok: false,
          message: "WebGPU detected, but no adapter was returned. Update GPU drivers or disable Remote Desktop/VM rendering.",
        }
      }

      try {
        await adapter.requestDevice()
      } catch {
        return {
          ok: false,
          message: "GPU adapter found, but device creation failed. Close heavy GPU apps/tabs and retry.",
        }
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "WebGPU initialization failed.",
      }
    }

    return { ok: true }
  }, [])

  const startShadowPrefetch = useCallback(async () => {
    if (shadowPrefetchStartedRef.current || settings.provider !== "webllm") return
    if (settings.webllmModel !== "Llama-3.2-1B-Instruct-q4f16_1-MLC") return

    shadowPrefetchStartedRef.current = true
    setWebLlmXpStage("shadow-prefetch")
    setShadowPrefetchProgress("Syncing with Neural Network - Level 3 (The Shadow) 0%")

    const prefetchPromise = (async () => {
      let shadowWorker: Worker | null = null
      try {
        const { engine, worker } = await createWorkerEngine(
          "Llama-3.2-3B-Instruct-q4f16_1-MLC",
          (report) => {
            const progressValue = typeof report.progress === "number" ? Math.round(report.progress * 100) : 0
            const progressText = report.text ? ` ${report.text}` : ""
            setShadowPrefetchProgress(
              `Syncing with Neural Network - Level 3 (The Shadow) ${progressValue}%${progressText}`.trim()
            )
          }
        )

        shadowWorker = worker
        setShadowPrefetchProgress("Syncing with Neural Network - Level 3 (The Shadow) complete")
        setWebLlmXpStage("shadow-unlocked")
        if (typeof (engine as { unload?: () => Promise<void> }).unload === "function") {
          await (engine as { unload: () => Promise<void> }).unload()
        }
      } catch {
        setShadowPrefetchProgress("Level 3 prefetch skipped - continuing with Echo model")
      } finally {
        shadowWorker?.terminate()
      }
    })()

    shadowPrefetchPromiseRef.current = prefetchPromise
    await prefetchPromise
  }, [settings.provider, settings.webllmModel, createWorkerEngine])

  const ensureWebLlmEngine = useCallback(async () => {
    if (webLlmEngineRef.current) {
      return webLlmEngineRef.current
    }
    if (webLlmInitPromiseRef.current) {
      return webLlmInitPromiseRef.current
    }

    setWebLlmStatus("downloading")
    setWebLlmError("")

    const initPromise = (async () => {
      const webGpuSupport = await diagnoseWebGpuSupport()
      if (!webGpuSupport.ok) {
        throw new Error(webGpuSupport.message)
      }
      const selectedModel = settings.webllmModel
      if (selectedModel === "Llama-3.2-1B-Instruct-q4f16_1-MLC") {
        setWebLlmXpStage("echo-sync")
      }

      const { engine } = await createWorkerEngine(selectedModel, (report) => {
        const progressValue =
          typeof report.progress === "number"
            ? `${Math.round(report.progress * 100)}%`
            : ""
        const progressText = report.text ? ` ${report.text}` : ""
        const prefix = selectedModel === "Llama-3.2-1B-Instruct-q4f16_1-MLC"
          ? "Syncing with Neural Network - Level 1 (The Echo)"
          : "Syncing with Neural Network"
        setWebLlmProgress(`${prefix} ${progressValue}${progressText}`.trim())
      })

      webLlmEngineRef.current = engine
      setWebLlmStatus("ready")
      return engine
    })()

    webLlmInitPromiseRef.current = initPromise

    try {
      return await initPromise
    } catch (error) {
      const message = error instanceof Error ? error.message : "WebLLM initialization failed"
      setWebLlmStatus("error")
      setWebLlmError(message)
      setLlmConnectionError(message)
      throw error
    } finally {
      webLlmInitPromiseRef.current = null
    }
  }, [settings.webllmModel, createWorkerEngine, diagnoseWebGpuSupport])

  const handleInitializeWebLlm = useCallback(async () => {
    setIsInitializingWebLlm(true)
    setLlmConnectionError("")
    try {
      await ensureWebLlmEngine()
      setWebLlmStatus("ready")
      setWebLlmProgress("Model ready for chat.")
    } catch {
      // Error state already handled in ensureWebLlmEngine.
    } finally {
      setIsInitializingWebLlm(false)
    }
  }, [ensureWebLlmEngine])

  useEffect(() => {
    if (settings.provider !== "webllm") return
    if (webLlmStatus !== "idle") return
    if (isInitializingWebLlm) return
    if (webLlmEngineRef.current || webLlmInitPromiseRef.current) return
    void handleInitializeWebLlm()
  }, [settings.provider, webLlmStatus, isInitializingWebLlm, handleInitializeWebLlm])

  const handleConnectLlmApi = useCallback(() => {
    setSettings((prev) =>
      prev.provider === "webllm"
        ? { ...prev, provider: "openrouter" }
        : prev
    )
    setShowSettings(true)
  }, [])

  const requestMcpFallbackReply = useCallback(
    async (text: string) => {
      if (!settings.mcpAutoFallback) return null

      const history = [...webLlmMessagesRef.current]
        .slice(-Math.max(2, settings.contextMessages - 1))
        .map((item) => ({
          role: item.sender === "user" ? "user" : "assistant",
          content: item.text,
        }))

      try {
        const userUnderstandingGuidance = buildUserUnderstandingGuidance(text)
        const response = await fetch("/api/mcp-fallback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mcpBaseUrl: settings.mcpBaseUrl,
            mcpModel: settings.mcpModel,
            mcpApiKey: settings.mcpApiKey,
            systemPrompt: `You are ${settings.name}, a ${settings.personality} empathetic companion. ${getToneModeInstruction(settings.toneMode)} Start with a specific emotional reflection, avoid repetitive thank-you openings, reply naturally in 2-4 sentences, and ask one meaningful follow-up question. ${userUnderstandingGuidance}`,
            messages: [...history, { role: "user", content: text }],
          }),
        })

        if (!response.ok) return null
        const payload = await response.json()
        if (typeof payload.text !== "string" || payload.text.trim().length === 0) {
          return null
        }
        return payload.text.trim()
      } catch {
        return null
      }
    },
    [
      settings.mcpAutoFallback,
      settings.mcpBaseUrl,
      settings.mcpModel,
      settings.mcpApiKey,
      settings.contextMessages,
      settings.name,
      settings.personality,
      settings.toneMode,
    ]
  )

  // Convert AI SDK UIMessage format to our Message format for the ChatPanel
  const remoteMessages: Message[] = useMemo(
    () =>
      chatMessages.map((msg) => ({
        id: msg.id,
        text:
          msg.parts
            ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("") || "",
        sender: msg.role === "user" ? ("user" as const) : ("ai" as const),
        timestamp: new Date(),
        emotion: currentEmotion,
      }))
      .map((msg) => {
        if (msg.sender !== "ai") return msg
        const extracted = extractDataUpdate(msg.text)
        const metaExtracted = extractMetaBlock(extracted.cleanText)
        return { ...msg, text: metaExtracted.cleanText || "I hear you. Could you share one more concrete detail?" }
      }),
    [chatMessages, currentEmotion]
  )

  useEffect(() => {
    const lastAssistant = [...chatMessages].reverse().find((msg) => msg.role === "assistant")
    if (!lastAssistant || processedRemoteUpdateIdsRef.current.has(lastAssistant.id)) {
      return
    }

    const rawText =
      lastAssistant.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("") || ""

    const extracted = extractDataUpdate(rawText)
    const metaExtracted = extractMetaBlock(extracted.cleanText)
    if (extracted.update) {
      setEmpathyData((prev) => {
        const next = applyDataUpdateBlock(prev, extracted.update || {})
        empathyDataRef.current = next
        return next
      })
    }

    applyMetaSignal(metaExtracted.meta, setSessionDepthLevel, setCurrentStep, setConversationSentimentScore)
    if (metaExtracted.meta) {
      setMetaHistory((prev) => [...prev.slice(-19), metaExtracted.meta!])
    }

    processedRemoteUpdateIdsRef.current.add(lastAssistant.id)
  }, [chatMessages])

  useEffect(() => {
    if (settings.provider !== "webllm") {
      fallbackPhase2InjectedRef.current = false
      return
    }
    if (!isColdFallbackMode || fallbackPhase < 2 || fallbackPhase >= 3 || fallbackPhase2InjectedRef.current) {
      return
    }

    setWebLlmMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: "I'm noticing a pattern... can we go a bit deeper?",
        sender: "ai",
        timestamp: new Date(),
        emotion: "thinking",
      },
    ])
    fallbackPhase2InjectedRef.current = true
  }, [settings.provider, isColdFallbackMode, fallbackPhase])

  const introQuestionCount = INTRO_CHAT_QUESTIONS.length
  const answeredIntroCount = introAnswers.slice(0, introQuestionCount).filter((ans) => ans.trim().length > 1).length
  const providerMessages = useMemo(
    () => (settings.provider === "webllm" ? webLlmMessages : [...remoteMessages, ...remoteFallbackMessages]),
    [settings.provider, webLlmMessages, remoteMessages, remoteFallbackMessages]
  )
  const messages = useMemo(
    () => [...onboardingChatMessages, ...providerMessages],
    [onboardingChatMessages, providerMessages]
  )
  const sessionDepth = Math.max(providerMessages.length + onboardingChatMessages.length, sessionDepthLevel)
  const introSentimentScore = useMemo(
    () => introAnswers.reduce((sum, answer) => sum + estimateSentimentScore(answer), 0),
    [introAnswers]
  )
  const totalSentimentScore = introSentimentScore + conversationSentimentScore
  const depthState = useMemo(
    () => getCurrentDepthTier(empathyData, totalSentimentScore, sessionDepth, sessionDepthLevel),
    [empathyData, totalSentimentScore, sessionDepth, sessionDepthLevel]
  )
  const emotionalVelocity = useMemo(() => {
    if (metaHistory.length < 2) {
      return Math.min(1, depthState.sentimentIntensity + sessionDepth / 40)
    }

    const depthDelta = metaHistory.slice(1).reduce((sum, item, index) => {
      const previous = metaHistory[index]
      return sum + Math.abs(item.depth - previous.depth)
    }, 0) / (metaHistory.length - 1)

    const polarityMean =
      metaHistory.reduce((sum, item) => sum + Math.abs(item.sentimentPolarity), 0) / metaHistory.length

    return Math.min(1, depthDelta / 4 + polarityMean / 2)
  }, [metaHistory, depthState.sentimentIntensity, sessionDepth])
  const deepestShadowQuestion = useMemo(() => getDeepestPossibleQuestion(empathyData), [empathyData])
  const suggestedNext = useMemo(
    () =>
      depthState.tier === "tier_4_shadow" || (isColdFallbackMode && fallbackPhase === 3)
        ? {
            question: toOpenEndedPrompt(deepestShadowQuestion),
            tier: "tier_4_shadow" as const,
            targetQuadrant: getLowestQuadrant(currentSummary).toUpperCase(),
          }
        : getNextDeepQuestion(currentSummary, depthState.tier, messages[messages.length - 1]?.text),
    [currentSummary, depthState.tier, deepestShadowQuestion, isColdFallbackMode, fallbackPhase, messages]
  )
  const latestUserText = useMemo(
    () => [...messages].reverse().find((message) => message.sender === "user")?.text || "",
    [messages]
  )
  const userUnderstandingSnapshot = useMemo(() => inferUserUnderstanding(latestUserText), [latestUserText])
  const samanthaGuidance = `${getDeepPrompt(currentSummary, sessionDepth, depthState.tier, emotionalVelocity)} Next mirror question: ${suggestedNext.question}`

  useEffect(() => {
    if (settings.provider !== "webllm") return
    if (answeredIntroCount < 2) return
    if (depthState.tier !== "tier_1_surface" && depthState.tier !== "tier_2_internal") return
    startShadowPrefetch()
  }, [settings.provider, answeredIntroCount, depthState.tier, startShadowPrefetch])

  const generateCurrentEmpathyCode = useCallback(() => {
    const resonance = generateEmpathyCode({
      empathyData,
      metaData: metaHistory,
      sentimentScoreTotal: totalSentimentScore,
      dominantEmotion: currentEmotion,
      intensityScore: emotionalVelocity * 100,
    })
    setEmpathyCode(resonance.code)
  }, [empathyData, metaHistory, totalSentimentScore, currentEmotion, emotionalVelocity])

  const handleIntroAnswerChange = useCallback((index: number, answer: string) => {
    setIntroAnswers((prev) => {
      const next = [...prev]
      const previous = next[index] || ""
      next[index] = answer

      if (previous.trim().length === 0 && answer.trim().length > 0 && !introCountedRef.current.has(index)) {
        introCountedRef.current.add(index)
        const question = EMPATHY_QUEST_BANK[index]
        const key = question.category.toLowerCase() as keyof EmpathyData
        setOnboardingSummary((summary) => ({
          ...summary,
          [key]: summary[key] + 1,
        }))
        setEmpathyData((data) => {
          const updated = {
            ...data,
            [key]: [...data[key], `Onboarding (${question.id}): ${answer.trim()}`].slice(-6),
          }
          empathyDataRef.current = updated
          return updated
        })
        setCurrentStep((step) => Math.min(step + 1, EMPATHY_QUEST_BANK.length - 1))
      }

      return next
    })
  }, [])

  useEffect(() => {
    if (!empathyCode && messages.length >= 6) {
      generateCurrentEmpathyCode()
    }
  }, [messages.length, empathyCode, generateCurrentEmpathyCode])

  useEffect(() => {
    if (!hasAgreed) return
    if (onboardingChatMessages.length > 0) return
    if (INTRO_CHAT_QUESTIONS.length === 0) return

    setOnboardingChatMessages([
      {
        id: crypto.randomUUID(),
        sender: "ai",
        text: "Before we begin, let's start simple. How are you feeling today?",
        timestamp: new Date(),
        emotion: "thinking",
      },
    ])
  }, [hasAgreed, onboardingChatMessages.length])

  const handleSendMessage = useCallback(
    async (text: string) => {
      setLlmConnectionError("")
      if (!sessionStartedAt) {
        setSessionStartedAt(Date.now())
      }

      // Detect emotion from text
      const textEmotion = detectEmotion(text)
      // Combine with camera emotion (prefer text if not neutral)
      const combinedEmotion = textEmotion !== "neutral" ? textEmotion : cameraEmotion

      // Hybrid fallback engine: always extract empathy-map signals even when model calls fail.
      const analysis = analyzeEmpathy(text, empathyDataRef.current)
      setEmpathyData(analysis.data)
      empathyDataRef.current = analysis.data
      setConversationSentimentScore((prev) => prev + analysis.sentimentScore)

      const intensity = sentimentIntensity(text)
      const sentimentEmotion =
        intensity > 0.5
          ? analysis.sentimentScore < 0
            ? "sad"
            : analysis.sentimentScore > 0
              ? "happy"
              : combinedEmotion
          : combinedEmotion
      setCurrentEmotion(sentimentEmotion)

      const isHowAreYouCheckIn = HOW_ARE_YOU_PATTERN.test(text)

      if (isHowAreYouCheckIn) {
        const checkInReply = buildHumanCheckInReply(settings.name, settings.personality)

        if (answeredIntroCount < introQuestionCount) {
          const introPrompt = INTRO_CHAT_QUESTIONS[answeredIntroCount]?.question
          setOnboardingChatMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              text,
              sender: "user",
              timestamp: new Date(),
              emotion: sentimentEmotion,
            },
            {
              id: crypto.randomUUID(),
              text: introPrompt
                ? `${checkInReply} Before we continue, ${toOpenEndedPrompt(introPrompt)}`
                : checkInReply,
              sender: "ai",
              timestamp: new Date(),
              emotion: "thinking",
            },
          ])
          return
        }

        if (settings.provider === "webllm") {
          setWebLlmMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              text,
              sender: "user",
              timestamp: new Date(),
              emotion: sentimentEmotion,
            },
            {
              id: crypto.randomUUID(),
              text: checkInReply,
              sender: "ai",
              timestamp: new Date(),
              emotion: "thinking",
            },
          ])
        } else {
          setRemoteFallbackMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              text,
              sender: "user",
              timestamp: new Date(),
              emotion: sentimentEmotion,
            },
            {
              id: crypto.randomUUID(),
              text: checkInReply,
              sender: "ai",
              timestamp: new Date(),
              emotion: "thinking",
            },
          ])
        }

        return
      }

      if (answeredIntroCount < introQuestionCount) {
        const introIndex = answeredIntroCount
        const currentIntroQuestion = INTRO_CHAT_QUESTIONS[introIndex]
        setOnboardingChatMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            text,
            sender: "user",
            timestamp: new Date(),
            emotion: sentimentEmotion,
          },
        ])

        if (needsClarificationForAnswer(text)) {
          setOnboardingChatMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              text: buildClarificationPrompt(currentIntroQuestion?.question),
              sender: "ai",
              timestamp: new Date(),
              emotion: "thinking",
            },
          ])
          return
        }

        handleIntroAnswerChange(introIndex, text)

        const nextIndex = introIndex + 1
        const nextPrompt = INTRO_CHAT_QUESTIONS[nextIndex]?.question
        const reflectiveBridge =
          analysis.sentimentScore < -0.25
            ? "That sounds emotionally heavy."
            : analysis.sentimentScore > 0.25
              ? "I can hear momentum in the way you describe this."
              : "I hear you clearly."
        const contextBridge = currentIntroQuestion?.followUp || "Stay with this for one more layer."
        setOnboardingChatMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            text: nextPrompt
              ? `${reflectiveBridge} ${contextBridge} ${buildAnswerAdaptivePrompt(text, nextPrompt)}`
              : "Thank you for sharing that. Opening up like this can be hard, and you are doing enough. We can move one step at a time from here - when you're ready, share the part that feels most alive right now.",
            sender: "ai",
            timestamp: new Date(),
            emotion: "thinking",
          },
        ])
        return
      }

      if (settings.provider === "webllm") {
        const userMessage: Message = {
          id: crypto.randomUUID(),
          text,
          sender: "user",
          timestamp: new Date(),
          emotion: sentimentEmotion,
        }

        const shouldUseImmediateFallback =
          webLlmStatus === "error" && !webLlmEngineRef.current

        if (shouldUseImmediateFallback) {
          const mcpFallbackText = await requestMcpFallbackReply(text)
          if (mcpFallbackText) {
            setWebLlmMessages((prev) => [
              ...prev,
              userMessage,
              {
                id: crypto.randomUUID(),
                text: mcpFallbackText,
                sender: "ai",
                timestamp: new Date(),
                emotion: sentimentEmotion,
                mode: "mcp-fallback",
              },
            ])
            return
          }

          const baseFallback = buildLocalCompanionReply(text, analysis.sentimentScore, suggestedNext.question)
          const fallbackText = ensureNonRepeatingFallback(
            baseFallback,
            lastFallbackReplyRef.current,
            suggestedNext.question
          )
          lastFallbackReplyRef.current = fallbackText

          setWebLlmMessages((prev) => [
            ...prev,
            userMessage,
            {
              id: crypto.randomUUID(),
              text: fallbackText,
              sender: "ai",
              timestamp: new Date(),
              emotion: sentimentEmotion,
              mode: "fallback",
            },
          ])
          return
        }

        setWebLlmMessages((prev) => [...prev, userMessage])
        setIsWebLlmLoading(true)

        try {
          const engine = await ensureWebLlmEngine()
          setWebLlmStatus("thinking")

          const conversation = [...webLlmMessagesRef.current, userMessage]
            .slice(-settings.contextMessages)
            .map((m) => ({
              role: m.sender === "user" ? "user" : "assistant",
              content: m.text,
            }))

          const completion = await engine.chat.completions.create({
            messages: [
              {
                role: "system",
                content: buildSystemPrompt(
                  settings.name,
                  settings.personality,
                  settings.toneMode,
                  sentimentEmotion,
                  empathyProfile,
                  empathyCode,
                  samanthaGuidance,
                  text
                ),
              },
              ...conversation,
            ],
            temperature: settings.temperature,
            top_p: settings.topP,
            max_tokens: settings.maxOutputTokens,
          })

          const aiContentRaw = completion.choices?.[0]?.message?.content
          const aiTextRaw =
            typeof aiContentRaw === "string"
              ? aiContentRaw
              : Array.isArray(aiContentRaw)
                ? aiContentRaw
                    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
                    .join("")
                : ""

          const extracted = extractDataUpdate(aiTextRaw)
          const metaExtracted = extractMetaBlock(extracted.cleanText)
          if (extracted.update) {
            const nextData = applyDataUpdateBlock(empathyDataRef.current, extracted.update)
            setEmpathyData(nextData)
            empathyDataRef.current = nextData
          }

          applyMetaSignal(metaExtracted.meta, setSessionDepthLevel, setCurrentStep, setConversationSentimentScore)
          if (metaExtracted.meta) {
            setMetaHistory((prev) => [...prev.slice(-19), metaExtracted.meta!])
          }

          const aiMessage: Message = {
            id: crypto.randomUUID(),
            text: metaExtracted.cleanText || "I am here with you. Could you tell me a little more?",
            sender: "ai",
            timestamp: new Date(),
            emotion: sentimentEmotion,
          }

          setWebLlmMessages((prev) => [...prev, aiMessage])
          setWebLlmStatus("ready")
          setLlmConnectionError("")
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown WebLLM error"
          setWebLlmStatus("error")
          setWebLlmError(message)
          setLlmConnectionError(message)

          const mcpFallbackText = await requestMcpFallbackReply(text)
          if (mcpFallbackText) {
            setWebLlmMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                text: mcpFallbackText,
                sender: "ai",
                timestamp: new Date(),
                emotion: sentimentEmotion,
                mode: "mcp-fallback",
              },
            ])
            return
          }

          const baseFallback = buildLocalCompanionReply(text, analysis.sentimentScore, suggestedNext.question)
          const fallbackText = ensureNonRepeatingFallback(
            baseFallback,
            lastFallbackReplyRef.current,
            suggestedNext.question
          )
          lastFallbackReplyRef.current = fallbackText

          const localFallback: Message = {
            id: crypto.randomUUID(),
            text: fallbackText,
            sender: "ai",
            timestamp: new Date(),
            emotion: sentimentEmotion,
            mode: "fallback",
          }
          setWebLlmMessages((prev) => [...prev, localFallback])

          console.error("WebLLM error:", error)
        } finally {
          setIsWebLlmLoading(false)
        }
        return
      }

      // Send via AI SDK for remote and Ollama providers
      try {
        await sendMessage({ text })
      } catch (error) {
        const message = error instanceof Error ? error.message : "LLM request failed"
        setLlmConnectionError(message)

        const baseFallback = buildLocalCompanionReply(text, analysis.sentimentScore, suggestedNext.question)
        const fallbackText = ensureNonRepeatingFallback(
          baseFallback,
          lastFallbackReplyRef.current,
          suggestedNext.question
        )
        lastFallbackReplyRef.current = fallbackText

        setRemoteFallbackMessages((prev) => {
          const hasMatchingUserTail = prev[prev.length - 1]?.sender === "user" && prev[prev.length - 1]?.text === text
          const withUserTurn = hasMatchingUserTail
            ? prev
            : [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  text,
                  sender: "user" as const,
                  timestamp: new Date(),
                },
              ]

          return [
            ...withUserTurn,
            {
              id: crypto.randomUUID(),
              text: fallbackText,
              sender: "ai",
              timestamp: new Date(),
              emotion: sentimentEmotion,
              mode: "fallback",
            },
          ]
        })
      }
    },
    [
      cameraEmotion,
      sendMessage,
      settings,
      ensureWebLlmEngine,
      empathyProfile,
      empathyCode,
      samanthaGuidance,
      suggestedNext.question,
      sessionStartedAt,
      answeredIntroCount,
      introQuestionCount,
      handleIntroAnswerChange,
      requestMcpFallbackReply,
      webLlmStatus,
    ]
  )

  const handleProfileImport = useCallback((profile: EmpathyProfile) => {
    setEmpathyProfile(profile)
  }, [])

  const handleProfileExport = useCallback(() => {
    const bundle = {
      profile: empathyProfile,
      empathyData,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `empathy-profile-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [empathyProfile, empathyData])

  const hasDownloadableError =
    Boolean(webLlmError) || Boolean(llmConnectionError) || (settings.provider === "webllm" && webLlmStatus === "error")

  const buildErrorPayload = useCallback(() => {
    const timestamp = new Date().toISOString()
    const modelInUse =
      settings.provider === "openai"
        ? PROVIDER_DEFAULT_MODELS.openai
        : settings.provider === "anthropic"
          ? PROVIDER_DEFAULT_MODELS.anthropic
          : settings.provider === "google"
            ? PROVIDER_DEFAULT_MODELS.google
            : settings.provider === "webllm"
              ? settings.webllmModel
              : settings.provider === "openrouter"
                ? settings.openRouterModel
                : settings.ollamaModel

      return {
      generatedAt: timestamp,
      app: "EMPATHEIA",
      runtime: {
        provider: settings.provider,
        model: modelInUse,
        systemHealth,
        webLlmStatus,
        webLlmProgress,
        webLlmXpStage,
        isLoading,
        isInitializingWebLlm,
      },
      errors: {
        llmConnectionError,
        webLlmError,
      },
      settingsSnapshot: {
        personality: settings.personality,
        toneMode: settings.toneMode,
        temperature: settings.temperature,
        topP: settings.topP,
        maxOutputTokens: settings.maxOutputTokens,
        contextMessages: settings.contextMessages,
        mcpAutoFallback: settings.mcpAutoFallback,
        hasOpenRouterApiKey: Boolean(settings.openRouterApiKey),
        hasMcpApiKey: Boolean(settings.mcpApiKey),
      },
      session: {
        startedAt: sessionStartedAt ? new Date(sessionStartedAt).toISOString() : null,
        elapsedMs,
        messageCount: messages.length,
        fallbackPhase,
        recentMessages: messages.slice(-8).map((m) => ({
          sender: m.sender,
          mode: m.mode || null,
          emotion: m.emotion || null,
          at: m.timestamp.toISOString(),
          preview: m.text.slice(0, 280),
        })),
      },
      environment: {
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        language: typeof navigator !== "undefined" ? navigator.language : "unknown",
      },
    }
  }, [
    elapsedMs,
    fallbackPhase,
    isInitializingWebLlm,
    isLoading,
    llmConnectionError,
    messages,
    sessionStartedAt,
    settings,
    systemHealth,
    webLlmError,
    webLlmProgress,
    webLlmStatus,
    webLlmXpStage,
  ])

  const handleDownloadErrorLog = useCallback(() => {
    const payload = buildErrorPayload()
    const timestamp = payload.generatedAt

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `empatheia-error-log-${timestamp.replace(/[.:]/g, "-")}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [buildErrorPayload])

  const handleCopyErrorSummary = useCallback(async () => {
    const payload = buildErrorPayload()
    const summary = [
      `EMPATHEIA Error Summary`,
      `generatedAt: ${payload.generatedAt}`,
      `provider: ${payload.runtime.provider}`,
      `model: ${payload.runtime.model}`,
      `systemHealth: ${payload.runtime.systemHealth}`,
      `webLlmStatus: ${payload.runtime.webLlmStatus}`,
      `llmConnectionError: ${payload.errors.llmConnectionError || "none"}`,
      `webLlmError: ${payload.errors.webLlmError || "none"}`,
      `messageCount: ${payload.session.messageCount}`,
      `fallbackPhase: ${payload.session.fallbackPhase}`,
      `recentMessages: ${payload.session.recentMessages.length}`,
    ].join("\n")

    try {
      await navigator.clipboard.writeText(summary)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = summary
      textarea.setAttribute("readonly", "")
      textarea.style.position = "absolute"
      textarea.style.left = "-9999px"
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
    }

    setErrorSummaryCopiedAt(Date.now())
  }, [buildErrorPayload])

  useEffect(() => {
    if (!errorSummaryCopiedAt) return
    const timer = window.setTimeout(() => {
      setErrorSummaryCopiedAt(null)
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [errorSummaryCopiedAt])

  const handleCameraEmotion = useCallback((emotion: Emotion) => {
    setCameraEmotion(emotion)
  }, [])

  const handleDeviceChange = useCallback(
    (deviceId: string) => {
      setSettings((prev) => ({ ...prev, cameraDeviceId: deviceId }))
    },
    []
  )

  const handleAcceptAgreement = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(agreementStorageKey, "accepted")
    }
    setHasAgreed(true)
  }, [agreementStorageKey])

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-background">
      {!hasAgreed && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 px-4">
          <div className="w-full max-w-xl rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Empathy Tool Agreement</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              This tool is designed to help you reflect, rethink, and re-evaluate negative thoughts with empathetic support.
              It is not a substitute for clinical care, diagnosis, or emergency support.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>I understand this is supportive guidance, not medical advice.</li>
              <li>I will seek professional help for urgent mental health concerns.</li>
              <li>I consent to using my conversation context and uploaded profile JSON for personalized responses.</li>
            </ul>

            <label className="mt-4 flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={agreementChecked}
                onChange={(e) => setAgreementChecked(e.target.checked)}
                className="mt-1"
              />
              <span>I have read and agree to use this empathy tool responsibly.</span>
            </label>

            <button
              onClick={handleAcceptAgreement}
              disabled={!agreementChecked}
              className="mt-4 w-full rounded border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              I Agree and Continue
            </button>
          </div>
        </div>
      )}

      {hasAgreed && showQuickStartModal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/90 px-4">
          <div className="w-full max-w-xl rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Choose Your Conversation Mode</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick one option and start chatting immediately. You can change this later in Settings.
            </p>

            <div className="mt-4 grid gap-3">
              <button
                onClick={() => handleChooseQuickPreset("fast-local")}
                className="rounded border border-border bg-background px-4 py-3 text-left transition-colors hover:border-muted-foreground/50"
              >
                <div className="text-sm font-semibold text-foreground">Fast & Local</div>
                <div className="text-xs text-muted-foreground">No API setup. Best first-run reliability.</div>
              </button>

              <button
                onClick={() => handleChooseQuickPreset("balanced-cloud")}
                className="rounded border border-border bg-background px-4 py-3 text-left transition-colors hover:border-muted-foreground/50"
              >
                <div className="text-sm font-semibold text-foreground">Balanced Cloud</div>
                <div className="text-xs text-muted-foreground">Recommended for most users. Smooth quality with low latency.</div>
              </button>

              <button
                onClick={() => handleChooseQuickPreset("deep-empathy")}
                className="rounded border border-border bg-background px-4 py-3 text-left transition-colors hover:border-muted-foreground/50"
              >
                <div className="text-sm font-semibold text-foreground">Deep Empathy</div>
                <div className="text-xs text-muted-foreground">Stronger reflection quality for long-form conversations.</div>
              </button>
            </div>

            <button
              onClick={() => handleChooseQuickPreset("default")}
              className="mt-4 w-full rounded border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Keep default settings for now
            </button>
          </div>
        </div>
      )}
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-foreground">
              EMPATHEIA
            </span>
            <span className="text-xs text-muted-foreground">
              AI Companion System v1.0
            </span>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="flex items-center gap-1 md:hidden">
          {(["camera", "chat", "empathy"] as const).map((panel) => (
            <button
              key={panel}
              onClick={() => setMobilePanel(panel)}
              className={`rounded px-3 py-1 text-xs font-medium ${
                mobilePanel === panel
                  ? "bg-foreground text-background"
                  : "text-muted-foreground"
              }`}
            >
              {panel.charAt(0).toUpperCase() + panel.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 md:flex">
            <span
              className={`h-2 w-2 rounded-full ${
                systemHealth === "fallback"
                  ? "bg-amber-500"
                  : systemHealth === "busy" || systemHealth === "initializing"
                    ? "animate-pulse bg-amber-500"
                    : "bg-emerald-500"
              }`}
            />
            <span className="text-sm text-muted-foreground">
              {systemHealth === "fallback"
                ? "Local Fallback Active"
                : systemHealth === "busy"
                  ? "System Busy"
                  : systemHealth === "initializing"
                    ? "System Initializing"
                    : "System Ready"}
            </span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden md:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* Main Content - Three Panel Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Camera & Controls */}
        <aside
          className={`w-full flex-shrink-0 overflow-y-auto border-r border-border p-4 md:w-72 lg:w-80 ${
            mobilePanel === "camera" ? "block" : "hidden md:block"
          }`}
        >
          <CameraPanel
            onEmotionDetected={handleCameraEmotion}
            selectedDeviceId={settings.cameraDeviceId}
            onDeviceChange={handleDeviceChange}
          />

          {/* Retro status readout */}
          <div className="mt-4 rounded border border-border bg-card p-4">
            <div className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground">
              SYSTEM STATUS
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider</span>
                <span className="text-foreground uppercase">
                  {settings.provider}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="font-mono text-foreground">
                  {settings.provider === "openai"
                    ? PROVIDER_DEFAULT_MODELS.openai
                    : settings.provider === "anthropic"
                      ? PROVIDER_DEFAULT_MODELS.anthropic
                      : settings.provider === "google"
                        ? PROVIDER_DEFAULT_MODELS.google
                        : settings.provider === "webllm"
                          ? settings.webllmModel
                          : settings.provider === "openrouter"
                            ? settings.openRouterModel
                            : settings.ollamaModel}
                </span>
              </div>
              {settings.provider === "webllm" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Runtime</span>
                    <span className="text-foreground uppercase">{webLlmStatus}</span>
                  </div>
                  {webLlmProgress && (
                    <div className="text-[10px] text-muted-foreground">{webLlmProgress}</div>
                  )}
                  {webLlmError && (
                    <div className="text-[10px] text-destructive">{webLlmError}</div>
                  )}
                  <button
                    onClick={handleInitializeWebLlm}
                    disabled={isInitializingWebLlm}
                    className="mt-1 rounded border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    {isInitializingWebLlm ? "Initializing..." : "Initialize Model"}
                  </button>
                </>
              )}
              {llmConnectionError && (
                <>
                  <div className="text-[10px] text-destructive">{llmConnectionError}</div>
                  <button
                    onClick={handleConnectLlmApi}
                    className="mt-1 rounded border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    Connect LLM API
                  </button>
                </>
              )}
              {hasDownloadableError && (
                <div className="mt-1 flex flex-wrap gap-1">
                  <button
                    onClick={handleDownloadErrorLog}
                    className="rounded border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    Download Error Log
                  </button>
                  <button
                    onClick={handleCopyErrorSummary}
                    className="rounded border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    {errorSummaryCopiedAt ? "Copied" : "Copy Error Summary"}
                  </button>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Personality</span>
                <span className="text-foreground uppercase">{settings.personality}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tone</span>
                <span className="text-foreground uppercase">{settings.toneMode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Temp</span>
                <span className="text-foreground">{settings.temperature}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Top P</span>
                <span className="text-foreground">{settings.topP.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Tokens</span>
                <span className="text-foreground">{settings.maxOutputTokens}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Emotion</span>
                <span className="text-foreground uppercase">{currentEmotion}</span>
              </div>
            </div>
          </div>

          <SetupChecklist
            settings={settings}
            runtime={{
              isLoading,
              llmConnectionError,
              webLlmStatus,
              webLlmError,
              webLlmXpStage,
              shadowPrefetchProgress,
            }}
          />

          {/* Decorative retro element */}
          <div className="mt-4 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-1 flex-1 bg-muted-foreground/10"
                  style={{
                    opacity: i < Math.ceil(8 * (currentEmotion === "neutral" ? 0.3 : 0.7)) ? 1 : 0.25,
                  }}
                />
              ))}
            </div>
            <div className="mt-1.5 text-center text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40">
              Emotional Intensity
            </div>
          </div>
        </aside>

        {/* Center Panel - Chat */}
        <section
          className={`flex flex-1 flex-col overflow-hidden ${
            mobilePanel === "chat" ? "block" : "hidden md:flex"
          }`}
        >
          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            emotion={currentEmotion}
            settings={settings}
          />
        </section>

        {/* Right Resize Handle */}
        <div
          onMouseDown={() => setIsResizingRightPanel(true)}
          className="hidden w-1 cursor-col-resize bg-border/70 transition-colors hover:bg-foreground/30 md:block"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize empathy panel"
        />

        {/* Right Panel - Empathy Map */}
        <aside
          className={`w-full flex-shrink-0 overflow-y-auto border-l border-border p-4 ${
            mobilePanel === "empathy" ? "block" : "hidden md:block"
          }`}
          style={{ width: mobilePanel === "empathy" ? "100%" : `${rightPanelWidth}px` }}
        >
          <EmpathyPanel
            data={empathyData}
            profile={empathyProfile}
            onProfileImport={handleProfileImport}
            onProfileExport={handleProfileExport}
            empathyCode={empathyCode}
            onGenerateEmpathyCode={generateCurrentEmpathyCode}
            messageCount={messages.length}
            depthTierLabel={DEPTH_TIER_LABELS[depthState.tier]}
            emotionalVelocity={emotionalVelocity}
            densityWords={depthState.wordDensity}
            densitySentiment={depthState.sentimentIntensity}
            suggestedQuestion={suggestedNext.question}
            fallbackPhase={fallbackPhase}
            userUnderstanding={userUnderstandingSnapshot}
          />
        </aside>
      </div>

      {/* Bottom Status Bar */}
      <footer className="flex items-center justify-between border-t border-border px-4 py-2 md:px-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
          <span>EMPATHEIA — AI Companion</span>
          <a
            href="https://www.sinhaankur.com"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Built by www.sinhaankur.com
          </a>
          <a
            href="https://github.com/sinhaankur/ideal-giggle#readme"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Read the docs
          </a>
        </div>
        <span className="text-xs text-muted-foreground/70">
          {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
        </span>
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSettingsChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </main>
  )
}
