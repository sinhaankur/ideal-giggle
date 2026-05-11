"use client"

import { useState, useCallback, useMemo, useEffect, useRef, type Dispatch, type SetStateAction } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useChat } from "@ai-sdk/react"
import { Settings, Download } from "lucide-react"
import { ChatPanel } from "@/components/chat-panel"
import { VaultModal, type VaultModalMode } from "@/components/vault-modal"
import {
  deriveVaultKey,
  encryptWithKey,
  unlockVault,
  type VaultEnvelope,
  type VaultKeyHandle,
  type VaultPayload,
  type SessionMemoryRecord,
  type SessionMemoryTurn,
} from "@/lib/vault/encrypted-profile"
import { clearStoredVault, loadStoredVault, saveStoredVault } from "@/lib/vault/vault-store"
import {
  DEFAULT_SETTINGS,
  DEFAULT_EMPATHY_PROFILE,
  PROVIDER_DEFAULT_MODELS,
  detectEmotion,
  analyzeEmpathy,
  estimateSentimentScore,
  sentimentIntensity,
  generateEmpathyCode,
  type AIProvider,
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
  describeFeltState,
  summarizeFeltState,
  composeConversationSummary,
  planFromContext,
  type ConversationSummary,
  type ResponsePlan,
  type RuntimeFallbackContext,
} from "@/lib/conversation/communication-engine"
import { sendOllamaDirect, probeOllama } from "@/lib/api/ollama-direct"
import { OnboardingModal } from "@/components/onboarding-modal"
import { useOnlineStatus } from "@/hooks/use-online-status"

const CameraPanel = dynamic(() => import("@/components/camera-panel").then((mod) => mod.CameraPanel), {
  ssr: false,
})

const EmpathyPanel = dynamic(() => import("@/components/empathy-panel").then((mod) => mod.EmpathyPanel))

const SettingsPanel = dynamic(() => import("@/components/settings-panel").then((mod) => mod.SettingsPanel))

const SetupChecklist = dynamic(() => import("@/components/setup-checklist").then((mod) => mod.SetupChecklist))

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

function buildLocalCompanionReply(
  input: string,
  sentimentScore: number,
  suggestedQuestion: string,
  context?: RuntimeFallbackContext,
  plan?: ResponsePlan | null
) {
  return buildLocalCompanionReplyFromEngine(input, sentimentScore, suggestedQuestion, context, plan)
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
    // Pin to Ollama as the local provider. The periodic Ollama probe will
    // surface a connection error if the daemon isn't running; the heuristic
    // therapy-engine compose path then handles replies until it's back.
    return {
      ...base,
      provider: "ollama",
      toneMode: "casual",
      personality: "warm",
      temperature: 0.7,
      maxOutputTokens: 260,
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
  userText: string,
  responsePlan?: ResponsePlan | null
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
    responsePlan,
  })
}

export default function CompanionApp() {
  const agreementStorageKey = "empatheia_user_agreement_v1"
  const quickPresetStorageKey = "empatheia_quick_preset_v1"
  const providerExplicitStorageKey = "empatheia_provider_explicit_v1"
  const rememberSessionsStorageKey = "empatheia_remember_sessions_v1"
  const ollamaAutoDetectDismissedKey = "empatheia_ollama_autodetect_dismissed_v1"
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
  const isOnline = useOnlineStatus()
  const [showQuickStartModal, setShowQuickStartModal] = useState(false)
  const [agreementChecked, setAgreementChecked] = useState(false)
  const [errorSummaryCopiedAt, setErrorSummaryCopiedAt] = useState<number | null>(null)
  const [llmConnectionError, setLlmConnectionError] = useState("")
  const [ollamaTransition, setOllamaTransition] = useState<{
    kind: "online" | "offline"
    model: string | null
    at: number
  } | null>(null)
  const ollamaReachableRef = useRef<boolean | null>(null)
  const autoSelectedOllamaRef = useRef(false)
  const [vaultStatus, setVaultStatus] = useState<"no-vault" | "locked" | "unlocked">("no-vault")
  const [vaultModalMode, setVaultModalMode] = useState<VaultModalMode | null>(null)
  const [vaultModalError, setVaultModalError] = useState("")
  const [vaultModalBusy, setVaultModalBusy] = useState(false)
  const [vaultLastSavedAt, setVaultLastSavedAt] = useState<number | null>(null)
  const vaultKeyHandleRef = useRef<VaultKeyHandle | null>(null)
  const pendingVaultEnvelopeRef = useRef<VaultEnvelope | null>(null)
  const vaultAutoSaveTimerRef = useRef<number | null>(null)
  // Session memory loaded from the vault on unlock — null when none was
  // stored or the user has never opted in. Drives the resume card.
  const [storedSessionMemory, setStoredSessionMemory] = useState<SessionMemoryRecord | null>(null)
  // The user has acted on the resume card (chose "Pick up" or "Start fresh"),
  // so don't show it again this session even if memory is still in the vault.
  const [resumeCardHandled, setResumeCardHandled] = useState(false)

  const empathyDataRef = useRef<EmpathyData>({
    says: [],
    thinks: [],
    does: [],
    feels: [],
  })
  const processedRemoteUpdateIdsRef = useRef<Set<string>>(new Set())
  const introCountedRef = useRef<Set<number>>(new Set())
  const fallbackPhase2InjectedRef = useRef(false)
  const lastFallbackReplyRef = useRef("")

  // Embed mode: when EMPATHEIA is iframed into another site or visited
  // with ?embed=1, render onboarding inline at the top of the page rather
  // than as a full-screen backdrop modal — modals on third-party origins
  // are user-hostile and tank conversion in shared/embed contexts.
  const [embedMode, setEmbedMode] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const explicit = params.get("embed") === "1"
    let isFramed = false
    try {
      isFramed = window.self !== window.top
    } catch {
      // cross-origin frame access throws — that itself implies we are framed
      isFramed = true
    }
    setEmbedMode(explicit || isFramed)
  }, [])

  // Honor PWA dock-menu shortcuts: ?panel=settings or ?panel=vault opens the
  // right surface immediately on launch. We strip the param from the URL after
  // applying it so it does not stick to the address bar.
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const panel = params.get("panel")
    if (!panel) return

    if (panel === "settings") {
      setShowSettings(true)
    } else if (panel === "vault") {
      const stored = loadStoredVault()
      setVaultModalMode(stored ? "unlock" : "create")
    }

    params.delete("panel")
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`
    window.history.replaceState({}, "", next)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const agreed = window.localStorage.getItem(agreementStorageKey) === "accepted"
    setHasAgreed(agreed)

    // Hydrate the cross-session memory toggle independently of the agreement
    // gate so refresh-then-re-agree still respects the prior choice.
    if (window.localStorage.getItem(rememberSessionsStorageKey) === "true") {
      setSettings((prev) => ({ ...prev, rememberSessions: true }))
    }

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
  }, [agreementStorageKey, quickPresetStorageKey, rememberSessionsStorageKey])

  // Periodic Ollama reachability probe.
  //
  // Goals:
  // - First run a few hundred ms after mount so the agreement modal has time to settle.
  // - Re-probe every 30s while the document is visible.
  // - Re-probe immediately when the tab returns to foreground.
  // - Auto-switch the provider only when reachability *changes*, never silently every poll.
  // - When Ollama appears we promote it; when it disappears (and we were the ones who
  //   promoted it) we leave the provider on "ollama" and surface a connection error so
  //   the heuristic therapy-engine fallback handles replies until the daemon is back.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!hasAgreed) return

    const PROBE_INTERVAL_MS = 30_000

    let cancelled = false
    let intervalId: number | null = null
    let inFlight = false
    // One controller for the whole effect lifetime. We never abort mid-probe
    // for "let's start a fresher one" reasons — we just skip the tick if a
    // probe is still running. The controller only fires on effect cleanup.
    const lifecycleController = new AbortController()

    const isUserExplicitProvider = (provider: AIProvider) =>
      provider === "openai" ||
      provider === "anthropic" ||
      provider === "google" ||
      provider === "openrouter"

    const runProbe = async () => {
      if (cancelled || inFlight) return
      inFlight = true

      const explicit = window.localStorage.getItem(providerExplicitStorageKey) === "true"
      const dismissed = window.localStorage.getItem(ollamaAutoDetectDismissedKey) === "true"

      // Per-request 2.5s deadline that aborts only this probe's fetch, not
      // the lifecycle controller.
      const requestController = new AbortController()
      const onLifecycleAbort = () => requestController.abort()
      lifecycleController.signal.addEventListener("abort", onLifecycleAbort, { once: true })
      const timeoutId = window.setTimeout(() => requestController.abort(), 2500)

      let result
      try {
        result = await probeOllama(
          settings.ollamaBaseUrl,
          settings.ollamaModel,
          requestController.signal
        )
      } finally {
        window.clearTimeout(timeoutId)
        lifecycleController.signal.removeEventListener("abort", onLifecycleAbort)
        inFlight = false
      }
      if (cancelled) return

      const wasReachable = ollamaReachableRef.current
      ollamaReachableRef.current = result.reachable

      // Online transition: Ollama just appeared.
      if (result.reachable && wasReachable !== true) {
        const detectedModel = result.pickedModel || settings.ollamaModel
        if (!explicit && !dismissed && !isUserExplicitProvider(settings.provider)) {
          autoSelectedOllamaRef.current = true
          setSettings((prev) =>
            prev.provider === "ollama"
              ? prev
              : { ...prev, provider: "ollama", ollamaModel: detectedModel }
          )
          if (wasReachable === false) {
            setOllamaTransition({ kind: "online", model: detectedModel, at: Date.now() })
          }
        }
        return
      }

      // Offline transition: Ollama just went away. Keep the provider on
      // "ollama" — the connection error will surface and the heuristic
      // therapy-engine compose path handles replies until Ollama is back.
      if (!result.reachable && wasReachable === true) {
        if (autoSelectedOllamaRef.current && settings.provider === "ollama") {
          autoSelectedOllamaRef.current = false
          setOllamaTransition({ kind: "offline", model: null, at: Date.now() })
        }
      }
    }

    runProbe()
    intervalId = window.setInterval(runProbe, PROBE_INTERVAL_MS)

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        runProbe()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      cancelled = true
      lifecycleController.abort()
      if (intervalId !== null) window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [
    hasAgreed,
    providerExplicitStorageKey,
    ollamaAutoDetectDismissedKey,
    settings.ollamaBaseUrl,
    settings.ollamaModel,
    settings.provider,
  ])

  // Auto-dismiss the transient online/offline transition banner after 6s.
  useEffect(() => {
    if (!ollamaTransition) return
    const timer = window.setTimeout(() => setOllamaTransition(null), 6000)
    return () => window.clearTimeout(timer)
  }, [ollamaTransition])

  // Vault: detect a stored vault on first load and prompt to unlock.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!hasAgreed) return
    const stored = loadStoredVault()
    if (!stored) {
      setVaultStatus("no-vault")
      return
    }
    setVaultStatus("locked")
    pendingVaultEnvelopeRef.current = stored
    setVaultModalError("")
    setVaultModalBusy(false)
    setVaultModalMode("unlock")
  }, [hasAgreed])

  const closeVaultModal = useCallback(() => {
    setVaultModalMode(null)
    setVaultModalError("")
    setVaultModalBusy(false)
  }, [])

  const handleVaultUploadEnvelope = useCallback((envelope: VaultEnvelope) => {
    pendingVaultEnvelopeRef.current = envelope
    setVaultStatus("locked")
    setVaultModalError("")
    setVaultModalBusy(false)
    setVaultModalMode("unlock")
  }, [])

  // Drag-drop a vault JSON file onto the window to import a past empathy
  // session. Light validation against the envelope shape before accepting.
  const [dragOverActive, setDragOverActive] = useState(false)
  const [dragImportError, setDragImportError] = useState("")
  const dragCounterRef = useRef(0)

  useEffect(() => {
    if (typeof window === "undefined") return

    const isVaultEnvelope = (value: unknown): value is VaultEnvelope => {
      if (!value || typeof value !== "object") return false
      const candidate = value as Record<string, unknown>
      return (
        typeof candidate.v === "number" &&
        typeof candidate.kdf === "string" &&
        typeof candidate.iter === "number" &&
        typeof candidate.salt === "string" &&
        typeof candidate.iv === "string" &&
        typeof candidate.ct === "string"
      )
    }

    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files")

    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      dragCounterRef.current += 1
      setDragOverActive(true)
    }
    const onOver = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
    }
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
      if (dragCounterRef.current === 0) setDragOverActive(false)
    }
    const onDrop = async (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragCounterRef.current = 0
      setDragOverActive(false)
      setDragImportError("")

      const file = event.dataTransfer?.files?.[0]
      if (!file) return
      if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
        setDragImportError("Drop a .json vault file exported from EMPATHEIA.")
        return
      }
      if (file.size > 256 * 1024) {
        setDragImportError("File is too large to be a vault envelope.")
        return
      }

      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        if (!isVaultEnvelope(parsed)) {
          setDragImportError("That file does not look like a vault envelope.")
          return
        }
        handleVaultUploadEnvelope(parsed)
      } catch {
        setDragImportError("Could not read that file as JSON.")
      }
    }

    window.addEventListener("dragenter", onEnter)
    window.addEventListener("dragover", onOver)
    window.addEventListener("dragleave", onLeave)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragenter", onEnter)
      window.removeEventListener("dragover", onOver)
      window.removeEventListener("dragleave", onLeave)
      window.removeEventListener("drop", onDrop)
    }
  }, [handleVaultUploadEnvelope])

  // Auto-clear the drag-import error toast after 6s.
  useEffect(() => {
    if (!dragImportError) return
    const timer = window.setTimeout(() => setDragImportError(""), 6000)
    return () => window.clearTimeout(timer)
  }, [dragImportError])

  const writeVaultEnvelopeToStorage = useCallback((envelopeJson: string) => {
    saveStoredVault(envelopeJson)
    setVaultLastSavedAt(Date.now())
  }, [])

  const downloadEnvelope = useCallback((envelopeJson: string) => {
    const blob = new Blob([envelopeJson], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `empatheia-vault-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleVaultModalSubmit = useCallback(
    async (passphrase: string) => {
      if (!vaultModalMode) return
      setVaultModalBusy(true)
      setVaultModalError("")

      try {
        if (vaultModalMode === "unlock") {
          const envelope = pendingVaultEnvelopeRef.current
          if (!envelope) {
            throw new Error("No vault to unlock")
          }
          const { payload, handle } = await unlockVault(envelope, passphrase)
          vaultKeyHandleRef.current = handle
          setEmpathyProfile(payload.profile)
          setEmpathyData(payload.empathyData)
          setStoredSessionMemory(payload.sessionMemory ?? null)
          setResumeCardHandled(false)
          // Persist the same envelope to localStorage in case it came from an uploaded file.
          writeVaultEnvelopeToStorage(JSON.stringify(envelope, null, 2))
          setVaultStatus("unlocked")
          pendingVaultEnvelopeRef.current = null
          closeVaultModal()
        } else if (vaultModalMode === "create") {
          const handle = await deriveVaultKey(passphrase)
          vaultKeyHandleRef.current = handle
          const bundle: VaultPayload = {
            profile: empathyProfile,
            empathyData,
            exportedAt: new Date().toISOString(),
          }
          const envelopeJson = await encryptWithKey(bundle, handle)
          writeVaultEnvelopeToStorage(envelopeJson)
          downloadEnvelope(envelopeJson)
          setVaultStatus("unlocked")
          closeVaultModal()
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Operation failed"
        setVaultModalError(message)
        setVaultModalBusy(false)
      }
    },
    [vaultModalMode, empathyProfile, empathyData, closeVaultModal, downloadEnvelope, writeVaultEnvelopeToStorage]
  )

  const handleVaultModalConfirm = useCallback(() => {
    if (vaultModalMode === "confirm-clear") {
      clearStoredVault()
      vaultKeyHandleRef.current = null
      pendingVaultEnvelopeRef.current = null
      setVaultStatus("no-vault")
      setVaultLastSavedAt(null)
      // Clearing the vault also wipes any in-memory session memory the
      // resume card was waiting to surface.
      setStoredSessionMemory(null)
      setResumeCardHandled(false)
    } else if (vaultModalMode === "confirm-lock") {
      vaultKeyHandleRef.current = null
      setVaultStatus("locked")
      // Lock the memory along with the rest of the vault. It still lives
      // encrypted in localStorage; next unlock re-reads it.
      setStoredSessionMemory(null)
      setResumeCardHandled(false)
    }
    closeVaultModal()
  }, [vaultModalMode, closeVaultModal])

  const requestVaultLock = useCallback(() => {
    setVaultModalError("")
    setVaultModalBusy(false)
    setVaultModalMode("confirm-lock")
  }, [])

  const requestVaultClear = useCallback(() => {
    setVaultModalError("")
    setVaultModalBusy(false)
    setVaultModalMode("confirm-clear")
  }, [])

  // Auto-save: when unlocked, encrypt + persist any change to profile or
  // empathy map. The session-memory branch lives in a separate effect
  // further down because `messages`/`summaryCard`/`feltState` are derived
  // later in the component.
  useEffect(() => {
    if (vaultStatus !== "unlocked") return
    const handle = vaultKeyHandleRef.current
    if (!handle) return

    if (vaultAutoSaveTimerRef.current !== null) {
      window.clearTimeout(vaultAutoSaveTimerRef.current)
    }

    vaultAutoSaveTimerRef.current = window.setTimeout(async () => {
      try {
        const bundle: VaultPayload = {
          profile: empathyProfile,
          empathyData,
          exportedAt: new Date().toISOString(),
        }
        const envelopeJson = await encryptWithKey(bundle, handle)
        writeVaultEnvelopeToStorage(envelopeJson)
      } catch {
        // Auto-save failures are silent (key may have been cleared mid-flight).
      }
    }, 1000)

    return () => {
      if (vaultAutoSaveTimerRef.current !== null) {
        window.clearTimeout(vaultAutoSaveTimerRef.current)
        vaultAutoSaveTimerRef.current = null
      }
    }
  }, [vaultStatus, empathyProfile, empathyData, writeVaultEnvelopeToStorage])

  const handleSettingsChange = useCallback<Dispatch<SetStateAction<CompanionSettings>>>(
    (update) => {
      setSettings((prev) => {
        const next = typeof update === "function" ? (update as (s: CompanionSettings) => CompanionSettings)(prev) : update
        if (typeof window !== "undefined") {
          if (next.provider !== prev.provider) {
            window.localStorage.setItem(providerExplicitStorageKey, "true")
          }
          if (next.rememberSessions !== prev.rememberSessions) {
            if (next.rememberSessions) {
              window.localStorage.setItem(rememberSessionsStorageKey, "true")
            } else {
              window.localStorage.removeItem(rememberSessionsStorageKey)
            }
          }
        }
        return next
      })
    },
    [providerExplicitStorageKey, rememberSessionsStorageKey]
  )

  const handleChooseQuickPreset = useCallback(
    (preset: QuickPresetId | "default") => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(quickPresetStorageKey, preset)

        // Choosing "fast-local" opts in to runtime provider negotiation:
        // clear any prior explicit/dismiss flags so the Ollama probe can
        // promote the session to a local daemon when one is reachable.
        if (preset === "fast-local") {
          window.localStorage.removeItem(providerExplicitStorageKey)
          window.localStorage.removeItem(ollamaAutoDetectDismissedKey)
          autoSelectedOllamaRef.current = false
          ollamaReachableRef.current = null
        }
      }

      if (preset !== "default") {
        setSettings((prev) => withQuickPreset(prev, preset))
      }

      setShowQuickStartModal(false)
    },
    [quickPresetStorageKey, providerExplicitStorageKey, ollamaAutoDetectDismissedKey]
  )

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
  const isLoading = isRemoteLoading
  const hasLocalFallbackActive = Boolean(llmConnectionError)
  const systemHealth = hasLocalFallbackActive ? "fallback" : isLoading ? "busy" : "ready"
  const isColdFallbackMode = Boolean(llmConnectionError)
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
    // Clear stale connection diagnostics when switching providers so the new
    // provider isn't immediately marked as in fallback by a previous error.
    setLlmConnectionError("")
  }, [settings.provider])

  const handleConnectLlmApi = useCallback(() => {
    setShowSettings(true)
  }, [])

  const requestMcpFallbackReply = useCallback(
    async (text: string) => {
      if (!settings.mcpAutoFallback) return null

      const history = [...remoteFallbackMessages]
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
      remoteFallbackMessages,
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
    if (!isColdFallbackMode) {
      fallbackPhase2InjectedRef.current = false
      return
    }
    if (fallbackPhase < 2 || fallbackPhase >= 3 || fallbackPhase2InjectedRef.current) {
      return
    }

    setRemoteFallbackMessages((prev) => [
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
  }, [isColdFallbackMode, fallbackPhase])

  const introQuestionCount = INTRO_CHAT_QUESTIONS.length
  const answeredIntroCount = introAnswers.slice(0, introQuestionCount).filter((ans) => ans.trim().length > 1).length
  const providerMessages = useMemo(
    () => [...remoteMessages, ...remoteFallbackMessages],
    [remoteMessages, remoteFallbackMessages]
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
  const feltState = useMemo(
    () => (latestUserText ? describeFeltState(latestUserText, cameraEmotion) : null),
    [latestUserText, cameraEmotion]
  )
  const samanthaGuidance = `${getDeepPrompt(currentSummary, sessionDepth, depthState.tier, emotionalVelocity)} Next mirror question: ${suggestedNext.question}${feltState ? ` Current felt-state read: ${summarizeFeltState(feltState)}.` : ""}`

  // Live "What I'm tracking" timeline — every time the four-quadrant
  // empathy data gains an entry, append it here with a timestamp so the
  // empathy panel can render the engine's running thoughts as a feed.
  // We diff against a ref of the prior snapshot so we don't have to touch
  // each setEmpathyData call site (there are many).
  type TimelineEntry = {
    id: string
    at: number
    quadrant: keyof EmpathyData
    entry: string
  }
  const [empathyTimeline, setEmpathyTimeline] = useState<TimelineEntry[]>([])
  const previousEmpathyDataRef = useRef<EmpathyData>({
    says: [],
    thinks: [],
    does: [],
    feels: [],
  })

  useEffect(() => {
    const previous = previousEmpathyDataRef.current
    const additions: TimelineEntry[] = []
    const now = Date.now()
    ;(["says", "thinks", "does", "feels"] as const).forEach((quadrant) => {
      const previousSet = new Set(previous[quadrant])
      for (const entry of empathyData[quadrant]) {
        if (!previousSet.has(entry) && entry.trim().length > 0) {
          additions.push({
            id: `${quadrant}-${now}-${additions.length}`,
            at: now,
            quadrant,
            entry,
          })
        }
      }
    })
    if (additions.length > 0) {
      // Cap timeline at 80 entries so a long session does not bloat memory.
      setEmpathyTimeline((prev) => [...prev, ...additions].slice(-80))
    }
    previousEmpathyDataRef.current = empathyData
  }, [empathyData])

  // Conversation summary card. Generated locally from existing empathy data
  // so it works offline and cheap; surfaces every 10 user turns or via the
  // manual "Summarize" button. Stays unread until the user dismisses or
  // exports, which drives the OS app badge.
  const userTurnCount = useMemo(
    () => messages.filter((m) => m.sender === "user").length,
    [messages]
  )
  const [summaryCard, setSummaryCard] = useState<ConversationSummary | null>(null)
  const [summaryUnread, setSummaryUnread] = useState(false)
  const lastSummaryAtTurnRef = useRef(0)

  const buildSummaryCard = useCallback(() => {
    return composeConversationSummary({
      userTurnCount,
      empathyData: empathyDataRef.current,
      feltState,
      empathyCode,
      durationMinutes: elapsedMs / 60000,
    })
  }, [userTurnCount, feltState, empathyCode, elapsedMs])

  const handleGenerateSummary = useCallback(() => {
    const next = buildSummaryCard()
    setSummaryCard(next)
    setSummaryUnread(true)
    lastSummaryAtTurnRef.current = userTurnCount
  }, [buildSummaryCard, userTurnCount])

  // Auto-generate every 10 user turns once onboarding is past.
  useEffect(() => {
    if (userTurnCount < 10) return
    if (userTurnCount - lastSummaryAtTurnRef.current < 10) return
    if (answeredIntroCount < introQuestionCount) return
    handleGenerateSummary()
  }, [userTurnCount, answeredIntroCount, introQuestionCount, handleGenerateSummary])

  // App Badging API — light up the OS dock/icon when a summary is unread.
  useEffect(() => {
    if (typeof navigator === "undefined") return
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    if (summaryUnread && summaryCard && nav.setAppBadge) {
      nav.setAppBadge(1).catch(() => undefined)
    } else if (nav.clearAppBadge) {
      nav.clearAppBadge().catch(() => undefined)
    }
  }, [summaryUnread, summaryCard])

  const dismissSummaryCard = useCallback(() => {
    setSummaryCard(null)
    setSummaryUnread(false)
  }, [])

  // Build a small session-memory record from the live conversation. Capped
  // so the encrypted vault stays small; older turns drop off the back.
  // Only saves once the intro questions are complete — the intro chat is
  // scaffolding, not a real conversation, and we don't want a returning
  // user to be re-greeted with their own onboarding answers.
  const RECENT_TURN_CAP = 20
  const sessionMemoryToPersist = useMemo<SessionMemoryRecord | null>(() => {
    if (!settings.rememberSessions) return null
    if (answeredIntroCount < introQuestionCount) return null
    const turns: SessionMemoryTurn[] = messages
      .filter((m) => m.text && m.text.trim().length > 0)
      .slice(-RECENT_TURN_CAP)
      .map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        text: m.text,
        at:
          m.timestamp instanceof Date
            ? m.timestamp.toISOString()
            : new Date(m.timestamp).toISOString(),
      }))
    if (turns.length === 0) return null
    return {
      savedAt: new Date().toISOString(),
      headline: summaryCard?.headline || feltState?.primary || "in motion",
      summaryParagraphs: summaryCard?.paragraphs || [],
      turns,
    }
  }, [
    settings.rememberSessions,
    answeredIntroCount,
    introQuestionCount,
    messages,
    summaryCard,
    feltState,
  ])

  // When session memory is enabled and changing, fold it into the next
  // vault save. We deliberately re-encrypt the whole payload (profile +
  // empathyData + sessionMemory) on a debounce so the file always
  // reflects the latest state. Disabled paths leave the vault untouched.
  const sessionMemorySaveTimerRef = useRef<number | null>(null)
  useEffect(() => {
    if (vaultStatus !== "unlocked") return
    if (!settings.rememberSessions) return
    if (!sessionMemoryToPersist) return
    const handle = vaultKeyHandleRef.current
    if (!handle) return

    if (sessionMemorySaveTimerRef.current !== null) {
      window.clearTimeout(sessionMemorySaveTimerRef.current)
    }

    sessionMemorySaveTimerRef.current = window.setTimeout(async () => {
      try {
        const bundle: VaultPayload = {
          profile: empathyProfile,
          empathyData,
          exportedAt: new Date().toISOString(),
          sessionMemory: sessionMemoryToPersist,
        }
        const envelopeJson = await encryptWithKey(bundle, handle)
        writeVaultEnvelopeToStorage(envelopeJson)
      } catch {
        // Silent: same rationale as the main auto-save.
      }
    }, 1500)

    return () => {
      if (sessionMemorySaveTimerRef.current !== null) {
        window.clearTimeout(sessionMemorySaveTimerRef.current)
        sessionMemorySaveTimerRef.current = null
      }
    }
  }, [
    vaultStatus,
    settings.rememberSessions,
    sessionMemoryToPersist,
    empathyProfile,
    empathyData,
    writeVaultEnvelopeToStorage,
  ])

  // Resume / start-fresh handlers for the cross-session memory card.
  // Resume injects the stored turns into the current provider's message
  // bucket so they render alongside any new turn the user takes.
  const handleResumeSession = useCallback(() => {
    if (!storedSessionMemory) return
    const resumed: Message[] = storedSessionMemory.turns.map((turn, index) => ({
      id: `resumed-${index}-${turn.at}`,
      text: turn.text,
      sender: turn.role === "user" ? ("user" as const) : ("ai" as const),
      timestamp: new Date(turn.at),
    }))

    setRemoteFallbackMessages((prev) => [...resumed, ...prev])

    // The user already poured themselves out before. Skip the hardcoded
    // "How are you feeling today?" greeting and the intro-question gate
    // by clearing the onboarding chat and marking intros complete.
    // empathyData is already restored from the vault, so the empathy map
    // continues from where it was.
    setOnboardingChatMessages([])
    setIntroAnswers((prev) => {
      const next = [...prev]
      for (let i = 0; i < INTRO_CHAT_QUESTIONS.length; i += 1) {
        if (!next[i] || next[i].trim().length === 0) {
          next[i] = "(resumed from previous session)"
        }
      }
      return next
    })

    setResumeCardHandled(true)
  }, [storedSessionMemory])

  const handleStartFreshSession = useCallback(() => {
    setResumeCardHandled(true)
  }, [])

  // Wipe stored session memory from the encrypted vault. Triggered by the
  // Settings panel when the user disables remembering or hits "Forget all".
  const handleForgetSessionMemory = useCallback(async () => {
    setStoredSessionMemory(null)
    const handle = vaultKeyHandleRef.current
    if (!handle) return
    try {
      const bundle: VaultPayload = {
        profile: empathyProfile,
        empathyData,
        exportedAt: new Date().toISOString(),
      }
      const envelopeJson = await encryptWithKey(bundle, handle)
      writeVaultEnvelopeToStorage(envelopeJson)
    } catch {
      // Silent: key may have been cleared mid-flight. Memory is already
      // dropped from in-memory state so the UI is honest either way.
    }
  }, [empathyProfile, empathyData, writeVaultEnvelopeToStorage])

  const showResumeCard =
    settings.rememberSessions &&
    storedSessionMemory !== null &&
    !resumeCardHandled &&
    vaultStatus === "unlocked"

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

      // One ResponsePlan per user turn. Drives the LLM system prompt
      // (when remote) and the local fallback (when offline / errored).
      // metaHistory gives us the recent-readings trajectory needed for
      // regulation / arc classification.
      const recentReadings = metaHistory.slice(-5).map((m) => ({
        valence: m.sentimentPolarity,
        arousal: Math.min(1, m.depth / 10),
      }))
      const responsePlan = planFromContext({
        text,
        cameraEmotion: combinedEmotion,
        userTurnCount: messages.filter((m) => m.sender === "user").length + 1,
        sessionMinutes: elapsedMs / 60000,
        recentReadings,
        wantsForwardMotion: inferUserUnderstanding(text).primaryIntent === "problem-solving",
        preferredName: empathyProfile?.preferredName,
      })

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

      // Ollama: when the Next.js /api/chat proxy is unavailable (static export
      // or offline), call the daemon directly from the browser. Requires the
      // user to start Ollama with OLLAMA_ORIGINS allowing this origin.
      const isStaticExportRuntime =
        process.env.NEXT_PUBLIC_STATIC_EXPORT === "true"
      const shouldRouteOllamaDirect =
        settings.provider === "ollama" && (isStaticExportRuntime || !isOnline)

      if (shouldRouteOllamaDirect) {
        const userMessage: Message = {
          id: crypto.randomUUID(),
          text,
          sender: "user",
          timestamp: new Date(),
          emotion: sentimentEmotion,
        }
        setRemoteFallbackMessages((prev) => [...prev, userMessage])

        const conversation = [...remoteFallbackMessages, userMessage]
          .slice(-settings.contextMessages)
          .map((m) => ({
            role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
            content: m.text,
          }))

        try {
          const result = await sendOllamaDirect({
            baseUrl: settings.ollamaBaseUrl,
            model: settings.ollamaModel,
            system: buildSystemPrompt(
              settings.name,
              settings.personality,
              settings.toneMode,
              sentimentEmotion,
              empathyProfile,
              empathyCode,
              samanthaGuidance,
              text,
              responsePlan
            ),
            messages: conversation,
            temperature: settings.temperature,
            topP: settings.topP,
            maxTokens: settings.maxOutputTokens,
          })

          const extracted = extractDataUpdate(result.text)
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

          setRemoteFallbackMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              text:
                metaExtracted.cleanText ||
                "I am here with you. Could you tell me a little more?",
              sender: "ai",
              timestamp: new Date(),
              emotion: sentimentEmotion,
            },
          ])
          setLlmConnectionError("")
        } catch (error) {
          const detail =
            error instanceof Error ? error.message : "Ollama direct call failed"
          setLlmConnectionError(detail)

          const baseFallback = buildLocalCompanionReply(
            text,
            analysis.sentimentScore,
            suggestedNext.question,
            {
              provider: settings.provider,
              llmConnectionError: detail,
              systemHealth,
              ollamaBaseUrl: settings.ollamaBaseUrl,
              ollamaModel: settings.ollamaModel,
            },
            responsePlan
          )
          const fallbackText = ensureNonRepeatingFallback(
            baseFallback,
            lastFallbackReplyRef.current,
            suggestedNext.question
          )
          lastFallbackReplyRef.current = fallbackText
          setRemoteFallbackMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              text: fallbackText,
              sender: "ai",
              timestamp: new Date(),
              emotion: sentimentEmotion,
              mode: "fallback",
            },
          ])
        }
        return
      }

      // Send via AI SDK for remote and Ollama providers
      try {
        await sendMessage({ text })
      } catch (error) {
        const message = error instanceof Error ? error.message : "LLM request failed"
        setLlmConnectionError(message)

        const baseFallback = buildLocalCompanionReply(text, analysis.sentimentScore, suggestedNext.question, {
          provider: settings.provider,
          llmConnectionError,
          systemHealth,
          ollamaBaseUrl: settings.ollamaBaseUrl,
          ollamaModel: settings.ollamaModel,
        }, responsePlan)
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
      empathyProfile,
      empathyCode,
      samanthaGuidance,
      suggestedNext.question,
      sessionStartedAt,
      answeredIntroCount,
      introQuestionCount,
      handleIntroAnswerChange,
      requestMcpFallbackReply,
      llmConnectionError,
      systemHealth,
      isOnline,
      remoteFallbackMessages,
    ]
  )

  const handleProfileImport = useCallback(
    (profile: EmpathyProfile, importedEmpathyData?: EmpathyData) => {
      setEmpathyProfile(profile)
      if (importedEmpathyData) {
        setEmpathyData(importedEmpathyData)
      }
    },
    []
  )

  const handleProfileExport = useCallback(async () => {
    // If vault is already unlocked, re-encrypt with cached key and download — no prompt.
    const handle = vaultKeyHandleRef.current
    if (handle && vaultStatus === "unlocked") {
      try {
        const bundle: VaultPayload = {
          profile: empathyProfile,
          empathyData,
          exportedAt: new Date().toISOString(),
        }
        const envelopeJson = await encryptWithKey(bundle, handle)
        writeVaultEnvelopeToStorage(envelopeJson)
        downloadEnvelope(envelopeJson)
        return
      } catch {
        // fall through to create flow
      }
    }
    setVaultModalError("")
    setVaultModalBusy(false)
    setVaultModalMode("create")
  }, [empathyProfile, empathyData, vaultStatus, downloadEnvelope, writeVaultEnvelopeToStorage])

  // Global keyboard shortcuts. Skipped while focus is inside an input so
  // typing real text never accidentally triggers settings/export/summary.
  // `metaKey` covers macOS Cmd, `ctrlKey` covers Windows/Linux. Web cannot
  // bind a true OS-level summon hotkey from a hidden window — that needs a
  // native wrapper — so these only fire when the app already has focus.
  useEffect(() => {
    if (typeof window === "undefined") return

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target.getAttribute("contenteditable") === "true"
      )
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return
      if (isTypingTarget(event.target)) return
      const key = event.key.toLowerCase()

      if (key === "k" && !event.shiftKey) {
        event.preventDefault()
        setShowSettings(true)
        return
      }
      if (key === "j" && !event.shiftKey) {
        event.preventDefault()
        handleProfileExport()
        return
      }
      if (key === "s" && event.shiftKey) {
        event.preventDefault()
        if (userTurnCount >= 4 && answeredIntroCount >= introQuestionCount) {
          handleGenerateSummary()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    userTurnCount,
    answeredIntroCount,
    introQuestionCount,
    handleGenerateSummary,
    handleProfileExport,
  ])

  const hasDownloadableError = Boolean(llmConnectionError)

  const buildErrorPayload = useCallback(() => {
    const timestamp = new Date().toISOString()
    const modelInUse =
      settings.provider === "openai"
        ? PROVIDER_DEFAULT_MODELS.openai
        : settings.provider === "anthropic"
          ? PROVIDER_DEFAULT_MODELS.anthropic
          : settings.provider === "google"
            ? PROVIDER_DEFAULT_MODELS.google
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
        isLoading,
      },
      errors: {
        llmConnectionError,
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
    isLoading,
    llmConnectionError,
    messages,
    sessionStartedAt,
    settings,
    systemHealth,
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
      `llmConnectionError: ${payload.errors.llmConnectionError || "none"}`,
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
      {dragOverActive && (
        <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center border-2 border-dashed border-emerald-400/60 bg-emerald-500/10 backdrop-blur-sm">
          <div className="rounded-lg border border-emerald-400/40 bg-background/80 px-4 py-3 text-center text-sm text-emerald-200 shadow-xl">
            <div className="text-base font-semibold">Drop vault file to import</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Encrypted EMPATHEIA vault JSON. You will be asked for the passphrase next.
            </div>
          </div>
        </div>
      )}

      {dragImportError && (
        <div className="absolute left-1/2 top-4 z-[55] -translate-x-1/2 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200 shadow-lg">
          {dragImportError}
        </div>
      )}

      <OnboardingModal
        hasAgreed={hasAgreed}
        showQuickStartModal={showQuickStartModal}
        agreementChecked={agreementChecked}
        onAgreementCheckedChange={setAgreementChecked}
        onAcceptAgreement={handleAcceptAgreement}
        onChoosePreset={handleChooseQuickPreset}
        embedMode={embedMode}
        ollamaReachable={ollamaReachableRef.current}
      />
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-foreground">
              EMPATHEIA
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
                  : systemHealth === "busy"
                    ? "animate-pulse bg-amber-500"
                    : "bg-emerald-500"
              }`}
            />
            <span className="text-sm text-muted-foreground">
              {systemHealth === "fallback"
                ? "Local Fallback Active"
                : systemHealth === "busy"
                  ? "System Busy"
                  : "System Ready"}
            </span>
          </div>
          <Link
            href="/ollama-install"
            className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            aria-label="Open install and run guide"
            title="Install your own private LLM"
          >
            <Download className="h-4 w-4" />
            <span className="hidden md:inline">Install</span>
          </Link>
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
                        : settings.provider === "openrouter"
                          ? settings.openRouterModel
                          : settings.ollamaModel}
                </span>
              </div>
              {llmConnectionError && (
                <>
                  <div className="text-[11px] text-destructive">{llmConnectionError}</div>
                  <button
                    onClick={handleConnectLlmApi}
                    className="mt-1 rounded border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    Connect LLM API
                  </button>
                </>
              )}
              {hasDownloadableError && (
                <div className="mt-1 flex flex-wrap gap-1">
                  <button
                    onClick={handleDownloadErrorLog}
                    className="rounded border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    Download Error Log
                  </button>
                  <button
                    onClick={handleCopyErrorSummary}
                    className="rounded border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    {errorSummaryCopiedAt ? "Copied" : "Copy Error Summary"}
                  </button>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Emotion</span>
                <span className="text-foreground uppercase">{currentEmotion}</span>
              </div>
            </div>
          </div>

          <SetupChecklist
            settings={settings}
            runtime={{ isLoading, llmConnectionError } as any}
          />

        </aside>

        {/* Center Panel - Chat */}
        <section
          className={`flex flex-1 flex-col overflow-hidden ${
            mobilePanel === "chat" ? "block" : "hidden md:flex"
          }`}
        >
          {ollamaTransition && (
            <div
              className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-[11px] ${
                ollamaTransition.kind === "online"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-200"
              }`}
              role="status"
              aria-live="polite"
            >
              <span>
                {ollamaTransition.kind === "online"
                  ? `Ollama just came online${ollamaTransition.model ? ` (${ollamaTransition.model})` : ""} — switched to local.`
                  : "Ollama went offline — local chat is paused until it's back."}
              </span>
              <button
                onClick={() => setOllamaTransition(null)}
                className="rounded border border-current/40 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] transition-colors hover:bg-foreground/10"
              >
                Dismiss
              </button>
            </div>
          )}

          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            emotion={currentEmotion}
            settings={settings}
            connectionError={llmConnectionError}
            systemHealth={systemHealth}
            introProgress={{ answered: answeredIntroCount, total: introQuestionCount }}
            onOpenSettings={() => setShowSettings(true)}
            isOffline={!isOnline}
            feltState={feltState}
            onMirrorCorrection={(correction) =>
              handleSendMessage(`(Correcting your read of me) ${correction}`)
            }
            summaryCard={summaryCard}
            onGenerateSummary={handleGenerateSummary}
            onDismissSummary={dismissSummaryCard}
            vaultUnlocked={vaultStatus === "unlocked"}
            canSummarize={
              userTurnCount >= 4 && answeredIntroCount >= introQuestionCount
            }
            resumeMemory={showResumeCard ? storedSessionMemory : null}
            onResumeSession={handleResumeSession}
            onStartFreshSession={handleStartFreshSession}
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
            vaultStatus={vaultStatus}
            vaultLastSavedAt={vaultLastSavedAt}
            onVaultEnvelopeUpload={handleVaultUploadEnvelope}
            onVaultLock={requestVaultLock}
            onVaultClear={requestVaultClear}
            timeline={empathyTimeline}
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

      <VaultModal
        open={vaultModalMode !== null}
        mode={vaultModalMode || "unlock"}
        errorMessage={vaultModalError}
        busy={vaultModalBusy}
        onCancel={closeVaultModal}
        onSubmit={handleVaultModalSubmit}
        onConfirm={handleVaultModalConfirm}
      />

      {/* Settings Modal */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
          vaultStatus={vaultStatus}
          hasSessionMemory={storedSessionMemory !== null}
          onForgetSessionMemory={handleForgetSessionMemory}
        />
      )}
    </main>
  )
}
