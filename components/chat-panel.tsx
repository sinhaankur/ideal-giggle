"use client"

import { useRef, useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Mic, MicOff, Volume2, VolumeX, BellOff, AlertTriangle, Wrench, RefreshCw, HeartHandshake, ShieldCheck, Cloud, WifiOff, Wind, BookOpen, Cpu, Sparkles } from "lucide-react"
import { AIOrb } from "@/components/ai-orb"
import { MirrorStrip } from "@/components/mirror-strip"
import { BreathCoach } from "@/components/breath-coach"
import { SummaryCard } from "@/components/summary-card"
import { ResumeSessionCard } from "@/components/resume-session-card"
import type { SessionMemoryRecord } from "@/lib/vault/encrypted-profile"
import type { Message, Emotion, CompanionSettings } from "@/lib/companion-types"
import { detectHarshLanguage } from "@/lib/conversation/language-tone"
import { splitIntoBeats } from "@/lib/conversation/message-beats"
import {
  suggestPromptsFromFeltState,
  type ConversationSummary,
  type FeltState,
} from "@/lib/conversation/communication-engine"

const ONBOARDING_PROMPT_POOL = [
  "I feel anxious because I am overloaded.",
  "The trigger was a conflict at work.",
  "My body feels tight in my chest.",
  "I notice I am holding my breath.",
  "I keep replaying a conversation in my head.",
  "I felt dismissed earlier today.",
  "There is a sadness I cannot name.",
  "I am tired in a way sleep does not fix.",
  "I felt small when they spoke.",
  "I want to be honest about what hurt.",
]

const OPEN_PROMPT_POOL = [
  "Help me calm down in 2 steps.",
  "Summarize what you understood about me.",
  "Ask me a deeper question.",
  "What do you notice about my pattern?",
  "Help me reframe this.",
  "Walk me through grounding.",
  "What would a kind friend say?",
  "What is one small step I can take?",
  "Tell me where my map is empty.",
  "Mirror back what I said in your own words.",
  "Where am I being too hard on myself?",
  "What feeling am I avoiding right now?",
]

const MOOD_OVERLAY_POOL: Record<Emotion, string[]> = {
  neutral: [],
  happy: ["Something good happened — let me share.", "I want to anchor this moment."],
  sad: ["It feels heavy right now.", "I want to be gentle with myself."],
  angry: ["I am frustrated and I want to vent.", "Help me channel this somewhere useful."],
  fear: ["I am scared and not sure why.", "Help me name the worst-case I am imagining."],
  surprise: ["Something unexpected just shifted.", "I am still processing this."],
  thinking: ["Help me think this through.", "I want to talk out loud."],
}

function pickThree<T>(pool: T[], seed: number): T[] {
  if (pool.length <= 3) return pool.slice(0, 3)
  const arr = [...pool]
  let rnd = seed >>> 0
  for (let i = arr.length - 1; i > 0; i--) {
    rnd = (rnd * 1103515245 + 12345) >>> 0
    const j = rnd % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, 3)
}

interface ChatPanelProps {
  messages: Message[]
  onSendMessage: (text: string) => void
  isLoading: boolean
  emotion: Emotion
  settings: CompanionSettings
  runtimeSource?: "unknown" | "ollama" | "webllm" | "remote" | "fallback"
  connectionError?: string
  systemHealth?: "ready" | "busy" | "fallback"
  introProgress?: { answered: number; total: number }
  onOpenSettings?: () => void
  isOffline?: boolean
  onUseLocalProvider?: () => void
  feltState?: FeltState | null
  onMirrorCorrection?: (correction: string) => void
  summaryCard?: ConversationSummary | null
  onGenerateSummary?: () => void
  onDismissSummary?: () => void
  onSaveSummaryToVault?: () => void | Promise<void>
  vaultUnlocked?: boolean
  canSummarize?: boolean
  resumeMemory?: SessionMemoryRecord | null
  onResumeSession?: () => void
  onStartFreshSession?: () => void
}

export function ChatPanel({
  messages,
  onSendMessage,
  isLoading,
  emotion,
  settings,
  runtimeSource = "unknown",
  connectionError,
  systemHealth,
  introProgress,
  onOpenSettings,
  isOffline,
  onUseLocalProvider,
  feltState,
  onMirrorCorrection,
  summaryCard,
  onGenerateSummary,
  onDismissSummary,
  onSaveSummaryToVault,
  vaultUnlocked,
  canSummarize,
  resumeMemory,
  onResumeSession,
  onStartFreshSession,
}: ChatPanelProps) {
  const [input, setInput] = useState("")
  const [isListening, setIsListening] = useState(false)
  // Whether this browser exposes the Web Speech API at all (Firefox doesn't),
  // so we can hide the mic rather than offer a button that silently no-ops.
  const [speechSupported, setSpeechSupported] = useState(false)
  // Transient, human-readable mic error (permission denied, no speech, etc.).
  const [micError, setMicError] = useState("")
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  // Snapshot of the input when listening starts, so the live transcript is
  // appended to what the user already typed instead of replacing it.
  const inputBeforeListenRef = useRef("")
  const inputRef = useRef<HTMLInputElement>(null)
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const activeSpeechTextRef = useRef("")
  const lastSpeechRequestRef = useRef<{ text: string; at: number }>({ text: "", at: 0 })
  const [uiNow, setUiNow] = useState(Date.now())
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)
  const [breathCoachOpen, setBreathCoachOpen] = useState(false)
  const breathDismissedRef = useRef(false)

  // Auto-close the breath coach if the load drops back down (so it doesn't
  // linger on the screen after the user has settled).
  useEffect(() => {
    if (feltState && feltState.load !== "high" && breathCoachOpen) {
      setBreathCoachOpen(false)
    }
  }, [feltState, breathCoachOpen])

  // Reset the "you already dismissed this once" guard if the user calms down
  // and then heats back up — re-offer the coach in the new flare.
  useEffect(() => {
    if (feltState && feltState.load !== "high") {
      breathDismissedRef.current = false
    }
  }, [feltState])

  useEffect(() => {
    const id = window.setInterval(() => setUiNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = window.localStorage.getItem("empatheia_voice_enabled")
    if (saved === "false") {
      setIsVoiceEnabled(false)
    }
  }, [])

  // Scroll to bottom on new messages and refocus input
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    // Focus input after AI responds
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.sender === "ai") {
        setTimeout(() => {
          inputRef.current?.focus()
        }, 100)

        // The last AI reply may render its closing question as a delayed
        // second beat that grows the bubble after the initial scroll. Follow
        // it once that beat has arrived so the question never lands off-screen.
        if (!settings.accessibilityMode && splitIntoBeats(lastMessage.text).length > 1) {
          const followUp = window.setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
          }, 650)
          return () => window.clearTimeout(followUp)
        }
      }
    }
  }, [messages, settings.accessibilityMode])

  // Setup speech recognition
  useEffect(() => {
    if (typeof window === "undefined") return
    const win = window as Window & {
      SpeechRecognition?: new () => any
      webkitSpeechRecognition?: new () => any
    }

    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechSupported(false)
      return
    }
    setSpeechSupported(true)

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-US"

    // Let the engine drive the listening state so the UI can't desync from
    // what the recognizer is actually doing.
    recognition.onstart = () => {
      setMicError("")
      setIsListening(true)
    }

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join("")
      // Append the live transcript to whatever was already typed, with a
      // space if needed, instead of clobbering it.
      const base = inputBeforeListenRef.current
      const joiner = base && !base.endsWith(" ") ? " " : ""
      setInput(`${base}${joiner}${transcript}`)
      if (event.results[event.results.length - 1].isFinal) {
        setIsListening(false)
      }
    }

    recognition.onerror = (event: any) => {
      // Map the most common SpeechRecognition error codes to plain language.
      const code = event?.error
      if (code === "not-allowed" || code === "service-not-allowed") {
        setMicError("Microphone access is blocked. Allow it in your browser to use voice input.")
      } else if (code === "no-speech") {
        setMicError("I didn't catch anything — try speaking again.")
      } else if (code === "audio-capture") {
        setMicError("No microphone found.")
      } else if (code !== "aborted") {
        setMicError("Voice input hit a snag. You can keep typing.")
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      // Detach handlers and stop any in-flight session on unmount.
      try {
        recognition.onstart = null
        recognition.onresult = null
        recognition.onerror = null
        recognition.onend = null
        recognition.abort()
      } catch {
        // ignore — recognition may not have started
      }
      recognitionRef.current = null
    }
  }, [])

  // Auto-clear a mic error after a few seconds so it doesn't linger.
  useEffect(() => {
    if (!micError) return
    const timer = window.setTimeout(() => setMicError(""), 5000)
    return () => window.clearTimeout(timer)
  }, [micError])

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      // Snapshot current input so the transcript appends rather than replaces,
      // then start. onstart flips isListening; if start() throws (e.g. already
      // running), surface it instead of leaving the UI in a wrong state.
      inputBeforeListenRef.current = input
      setMicError("")
      try {
        recognitionRef.current.start()
      } catch {
        setMicError("Couldn't start voice input. Try again in a moment.")
        setIsListening(false)
      }
    }
  }, [isListening, input])

  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    activeUtteranceRef.current = null
    activeSpeechTextRef.current = ""
    setIsSpeaking(false)
  }, [])

  // Text-to-speech for AI responses with loop and double-trigger protection.
  const speak = useCallback((text: string) => {
    if (!isVoiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return

    const normalizedText = text.trim()
    if (!normalizedText) return

    const now = Date.now()
    const lastRequest = lastSpeechRequestRef.current
    if (lastRequest.text === normalizedText && now - lastRequest.at < 400) {
      return
    }
    lastSpeechRequestRef.current = { text: normalizedText, at: now }

    // Clicking the same message while it is speaking stops playback instead of requeueing.
    if (isSpeaking && activeSpeechTextRef.current === normalizedText) {
      stopSpeaking()
      return
    }

    stopSpeaking()

    const utterance = new SpeechSynthesisUtterance(normalizedText)
    activeUtteranceRef.current = utterance
    activeSpeechTextRef.current = normalizedText
    // Pace and pitch follow the user's current emotional load. A heavier
    // mood gets a slower, lower voice; a lit-up mood gets a brighter one.
    // Falling back to the prior 0.9/1.1 for neutral/unknown so existing
    // installs don't suddenly sound different on resting state.
    const voiceProfile: Record<string, { rate: number; pitch: number }> = {
      sad: { rate: 0.82, pitch: 0.95 },
      fear: { rate: 0.85, pitch: 1.0 },
      angry: { rate: 0.88, pitch: 1.0 },
      thinking: { rate: 0.88, pitch: 1.05 },
      surprise: { rate: 0.95, pitch: 1.15 },
      happy: { rate: 0.95, pitch: 1.15 },
      neutral: { rate: 0.9, pitch: 1.1 },
    }
    const profile = voiceProfile[emotion] ?? voiceProfile.neutral
    utterance.rate = profile.rate
    utterance.pitch = profile.pitch
    utterance.onstart = () => {
      if (activeUtteranceRef.current === utterance) {
        setIsSpeaking(true)
      }
    }
    utterance.onend = () => {
      if (activeUtteranceRef.current === utterance) {
        activeUtteranceRef.current = null
        activeSpeechTextRef.current = ""
        setIsSpeaking(false)
      }
    }
    utterance.onerror = () => {
      if (activeUtteranceRef.current === utterance) {
        activeUtteranceRef.current = null
        activeSpeechTextRef.current = ""
        setIsSpeaking(false)
      }
    }

    window.speechSynthesis.speak(utterance)
  }, [isSpeaking, isVoiceEnabled, stopSpeaking, emotion])

  const toggleVoice = useCallback(() => {
    setIsVoiceEnabled((prev) => {
      const next = !prev
      if (typeof window !== "undefined") {
        window.localStorage.setItem("empatheia_voice_enabled", String(next))
        if (!next) stopSpeaking()
      }
      return next
    })
  }, [stopSpeaking])

  const emergencyMute = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
    stopSpeaking()
    setIsVoiceEnabled(false)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("empatheia_voice_enabled", "false")
    }
  }, [stopSpeaking])

  useEffect(() => {
    return () => {
      stopSpeaking()
    }
  }, [stopSpeaking])

  // Auto-focus input field on mount and after receiving message
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Keep focus on input by refocusing when document click happens on other elements
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Don't refocus if clicking on buttons, voice controls, or other interactive elements
      const isInteractiveElement = target.closest("button") || 
                                   target.closest("select") ||
                                   target.closest("textarea") ||
                                   (target.tagName === "INPUT" && target !== inputRef.current)
      
      if (!isInteractiveElement && inputRef.current) {
        inputRef.current.focus()
      }
    }

    // Add slight delay to allow natural interactions
    const timer = setTimeout(() => {
      document.addEventListener("click", handleDocumentClick)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("click", handleDocumentClick)
    }
  }, [])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isLoading) return
    // Stop any active dictation so it doesn't append onto the cleared input.
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      setIsListening(false)
    }
    onSendMessage(text)
    setInput("")
    inputBeforeListenRef.current = ""
    inputRef.current?.focus()
    setPromptSeed((seed) => seed + 1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const providerLabel =
    settings.provider === "ollama" ? "OLLAMA LOCAL" : settings.provider.toUpperCase()

  const introTotal = introProgress?.total || 0
  const introAnswered = introProgress?.answered || 0
  const isOnboardingActive = introTotal > 0 && introAnswered < introTotal
  const onboardingPercent = introTotal > 0 ? Math.round((introAnswered / introTotal) * 100) : 0

  const fallbackActive = systemHealth === "fallback" || Boolean(connectionError)
  const statusBannerText = fallbackActive
    ? connectionError || "Model connection is unstable. Local fallback responses are active."
    : ""

  const runtimeBadge = useMemo(() => {
    switch (runtimeSource) {
      case "ollama":
        return {
          label: "runtime: ollama",
          title: "Replies are generated by your local Ollama runtime.",
          className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
        }
      case "webllm":
        return {
          label: "runtime: webllm",
          title: "Replies are generated in-browser via WebGPU fallback.",
          className: "border-sky-500/40 bg-sky-500/10 text-sky-200",
        }
      case "remote":
        return {
          label: "runtime: api",
          title: "Replies are generated by the selected cloud/server API.",
          className: "border-amber-500/40 bg-amber-500/10 text-amber-200",
        }
      case "fallback":
        return {
          label: "runtime: local fallback",
          title: "Replies are generated by the deterministic local fallback engine.",
          className: "border-red-500/40 bg-red-500/10 text-red-200",
        }
      default:
        return {
          label: "runtime: detecting",
          title: "Runtime source will appear after the first reply.",
          className: "border-border bg-card text-muted-foreground",
        }
    }
  }, [runtimeSource])

  const [promptSeed, setPromptSeed] = useState(() => Math.floor(Math.random() * 1_000_000))

  const quickPrompts = useMemo(() => {
    if (isOnboardingActive) {
      return pickThree(ONBOARDING_PROMPT_POOL, promptSeed)
    }

    // Once the Mirror has read a felt state, prefer prompts that match it
    // exactly. The user just sees options that fit how they actually arrived,
    // not generic mood scaffolding. Refreshing the seed reshuffles within
    // the felt pool so they aren't stuck with the same three.
    if (feltState) {
      const tailored = suggestPromptsFromFeltState(feltState)
      if (tailored.length >= 3) return tailored
      if (tailored.length > 0) {
        const filler = OPEN_PROMPT_POOL.filter((p) => !tailored.includes(p))
        return [...tailored, ...pickThree(filler, promptSeed)].slice(0, 3)
      }
    }

    const overlay = MOOD_OVERLAY_POOL[emotion] || []
    return pickThree([...OPEN_PROMPT_POOL, ...overlay], promptSeed)
  }, [isOnboardingActive, emotion, promptSeed, feltState])

  const refreshPrompts = useCallback(() => {
    setPromptSeed((seed) => seed + 1)
  }, [])

  const harshSignal = useMemo(() => detectHarshLanguage(input), [input])

  const applyQuickPrompt = useCallback((index: number) => {
    const prompt = quickPrompts[index]
    if (!prompt) return
    setInput(prompt)
    inputRef.current?.focus()
  }, [quickPrompts])

  useEffect(() => {
    if (!settings.accessibilityMode) {
      setShowShortcutHelp(false)
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowShortcutHelp(false)
        emergencyMute()
        return
      }

      const activeElement = document.activeElement as HTMLElement | null
      const isTypingField =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.getAttribute("contenteditable") === "true"

      if (event.altKey && ["1", "2", "3"].includes(event.key)) {
        event.preventDefault()
        applyQuickPrompt(Number(event.key) - 1)
        return
      }

      if (!isTypingField && event.key === "/") {
        event.preventDefault()
        inputRef.current?.focus()
        return
      }

      if (!isTypingField && event.key === "?") {
        event.preventDefault()
        setShowShortcutHelp((prev) => !prev)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [applyQuickPrompt, emergencyMute, settings.accessibilityMode])

  const lastMessageAt = messages.length
    ? (messages[messages.length - 1].timestamp instanceof Date
        ? messages[messages.length - 1].timestamp.getTime()
        : new Date(messages[messages.length - 1].timestamp).getTime())
    : 0
  const secondsSinceLastMessage = lastMessageAt ? Math.max(0, (uiNow - lastMessageAt) / 1000) : Number.POSITIVE_INFINITY
  const hasRecentExchange = secondsSinceLastMessage <= 24
  const typingWeight = Math.min(1, input.trim().length / 40)

  const orbPhase: "idle" | "composing" | "engaged" | "thinking" | "listening" | "speaking" =
    isSpeaking
      ? "speaking"
      : isListening
        ? "listening"
        : isLoading
          ? "thinking"
          : typingWeight > 0
            ? "composing"
            : hasRecentExchange
              ? "engaged"
              : "idle"

  const orbActivity =
    orbPhase === "speaking"
      ? 0.95
      : orbPhase === "listening"
        ? 0.85
        : orbPhase === "thinking"
          ? 0.82
          : orbPhase === "composing"
            ? 0.45 + typingWeight * 0.35
            : orbPhase === "engaged"
              ? 0.42 + Math.max(0, (24 - secondsSinceLastMessage) / 24) * 0.28
              : 0.28

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-foreground">
            {settings.name}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {settings.personality} -- {providerLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const isLocalProvider = settings.provider === "ollama"
            const providerName = settings.provider === "openai"
              ? "OpenAI"
              : settings.provider === "anthropic"
                ? "Anthropic (Claude)"
                : settings.provider === "google"
                  ? "Google (Gemini)"
                  : settings.provider === "openrouter"
                    ? "OpenRouter"
                    : settings.provider.toUpperCase()
            const label = isLocalProvider ? "PRIVATE" : "CLOUD · NOT PRIVATE"
            const tooltip = isLocalProvider
              ? "This conversation runs entirely on your machine via Ollama. Nothing leaves the device. EMPATHEIA itself never sees your messages."
              : `Your messages are sent to ${providerName} over the internet for the AI to reply. ${providerName} processes them under their own policy and may retain logs. EMPATHEIA does not store them, but the conversation is NOT private end-to-end. For full privacy, switch to Ollama (PC LLM) in Settings.`
            return (
              <span
                className={`flex h-6 items-center gap-1 border px-2 text-[11px] uppercase tracking-wide ${
                  isLocalProvider
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/50 bg-amber-500/10 text-amber-300"
                }`}
                title={tooltip}
                aria-label={tooltip}
              >
                {isLocalProvider ? (
                  <ShieldCheck className="h-3 w-3" />
                ) : (
                  <Cloud className="h-3 w-3" />
                )}
                {label}
              </span>
            )
          })()}
          <span
            className={`flex h-6 items-center gap-1 border px-2 text-[11px] uppercase tracking-wide ${runtimeBadge.className}`}
            title={runtimeBadge.title}
            aria-label={runtimeBadge.title}
          >
            <Cpu className="h-3 w-3" />
            {runtimeBadge.label}
          </span>
          {onGenerateSummary && canSummarize && (
            <button
              onClick={onGenerateSummary}
              className="flex h-6 items-center gap-1 border border-sky-500/40 bg-sky-500/10 px-2 text-[11px] uppercase tracking-wide text-sky-200 transition-colors hover:bg-sky-500/20"
              aria-label="Generate a reflection summary of this conversation"
              title="Reflection summary"
            >
              <BookOpen className="h-3 w-3" />
              summary
            </button>
          )}
          <button
            onClick={emergencyMute}
            className="flex h-6 items-center gap-1 border border-destructive/50 bg-destructive/10 px-2 text-[11px] uppercase tracking-wide text-destructive transition-colors hover:bg-destructive/20"
            aria-label="Silence all audio"
            title="Emergency mute: stop voice output and disable audio"
          >
            <BellOff className="h-3 w-3" />
            mute
          </button>
          <button
            onClick={toggleVoice}
            className={`flex h-6 w-6 items-center justify-center border transition-colors ${
              isVoiceEnabled
                ? "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                : "border-foreground/40 bg-foreground/10 text-foreground hover:bg-foreground/20"
            }`}
            aria-label={isVoiceEnabled ? "Mute voice output" : "Enable voice output"}
            title={isVoiceEnabled ? "Voice: On" : "Voice: Off"}
          >
            {isVoiceEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* AI Orb Visualization — capped tighter on mobile so it doesn't
          eat half the viewport before the first message renders. */}
      <div className="flex items-center justify-center border-b border-border py-4 md:py-6">
        <div className="w-full max-w-[160px] md:max-w-[220px]">
          <AIOrb
            isListening={isListening}
            isSpeaking={isSpeaking}
            emotion={emotion}
            phase={orbPhase}
            activityLevel={orbActivity}
            intensity={orbActivity}
            reducedMotionEnabled={settings.accessibilityMode}
            confidence={feltState?.confidence ?? null}
          />
        </div>
      </div>

      {feltState && (
        <MirrorStrip
          state={feltState}
          onCorrect={onMirrorCorrection}
          reducedMotion={settings.accessibilityMode}
        />
      )}

      {feltState?.load === "high" && !breathCoachOpen && !breathDismissedRef.current && (
        <div className="flex items-center justify-between gap-3 border-b border-emerald-500/30 bg-emerald-500/5 px-4 py-2 text-[11px]">
          <div className="flex items-center gap-2 text-emerald-200">
            <Wind className="h-3.5 w-3.5" />
            <span>That sounds heavy. Want a 30-second breath together first?</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setBreathCoachOpen(true)}
              className="rounded border border-emerald-400/40 bg-background/40 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-200 transition-colors hover:bg-emerald-500/20"
            >
              Take a breath
            </button>
            <button
              onClick={() => {
                breathDismissedRef.current = true
                setBreathCoachOpen(false)
              }}
              className="rounded border border-border bg-card px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Dismiss breath suggestion"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {breathCoachOpen && (
        <BreathCoach
          onClose={() => {
            breathDismissedRef.current = true
            setBreathCoachOpen(false)
          }}
          reducedMotion={settings.accessibilityMode}
        />
      )}

      {isOffline && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs">
          <div className="flex items-center gap-2 text-amber-200">
            <WifiOff className="h-3.5 w-3.5" />
            <span className="leading-relaxed">
              {settings.provider === "ollama"
                ? "You are offline. Ollama on your machine keeps the conversation running."
                : "You are offline. Switch to Ollama (PC LLM) in Settings, or wait for the network to come back."}
            </span>
          </div>
          {settings.provider !== "ollama" && onUseLocalProvider && (
            <button
              onClick={onUseLocalProvider}
              className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-background/40 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200 transition-colors hover:bg-amber-500/20"
            >
              Use Ollama
            </button>
          )}
        </div>
      )}

      {statusBannerText && (
        <div className={`border-b px-4 py-2 text-xs ${fallbackActive ? "border-amber-500/30 bg-amber-500/10" : "border-border bg-card"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className={`h-3.5 w-3.5 ${fallbackActive ? "text-amber-300" : "text-muted-foreground"}`} />
              <span className="leading-relaxed">{statusBannerText}</span>
            </div>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-accent"
              >
                <Wrench className="h-3 w-3" />
                Fix
              </button>
            )}
          </div>
        </div>
      )}

      {isOnboardingActive && (
        <div className="border-b border-border bg-card px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>Onboarding Progress</span>
            <span>
              {introAnswered}/{introTotal}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-muted/30">
            <div
              className="h-full bg-foreground transition-all duration-300"
              style={{ width: `${Math.max(8, onboardingPercent)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Share concrete details for each intro step. After onboarding, responses switch to full conversation mode.
          </p>
        </div>
      )}

      {resumeMemory && onResumeSession && onStartFreshSession && (
        <ResumeSessionCard
          memory={resumeMemory}
          onResume={onResumeSession}
          onStartFresh={onStartFreshSession}
        />
      )}

      {summaryCard && onDismissSummary && (
        <SummaryCard
          summary={summaryCard}
          onDismiss={onDismissSummary}
          onSaveToVault={onSaveSummaryToVault}
          vaultUnlocked={vaultUnlocked}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Begin Conversation
            </div>
            <div className="max-w-[280px] text-[12px] leading-relaxed text-foreground/80">
              Share your thoughts, feelings, or whatever is on your mind. I am here to listen and understand.
            </div>
            <div className="mt-1 hidden max-w-[340px] text-[11px] leading-relaxed text-muted-foreground md:block">
              <span className="text-foreground/70">←</span> Camera (left) for mood-aware replies. Empathy map (right) <span className="text-foreground/70">→</span> updates as you talk.
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={promptSeed}
                  initial={settings.accessibilityMode ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={settings.accessibilityMode ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-wrap items-center justify-center gap-2"
                >
                  {quickPrompts.map((prompt, index) => (
                    <button
                      key={prompt}
                      onClick={() => applyQuickPrompt(index)}
                      className="rounded border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </motion.div>
              </AnimatePresence>
              <button
                onClick={refreshPrompts}
                aria-label="Refresh prompt suggestions"
                title="Try different suggestions"
                className="flex h-6 w-6 items-center justify-center rounded border border-border bg-card text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
        {messages.map((msg, index) => {
          // Group consecutive same-sender messages so a multi-stream
          // conversation (onboarding → live → fallback) reads as continuous
          // turns: tighter spacing within a group, and the AI sender header
          // only on the first message of each run.
          const prev = index > 0 ? messages[index - 1] : null
          const isGrouped = prev?.sender === msg.sender
          // Still show the header when the AI's mode badge changes mid-run
          // (e.g. switching into local fallback) so that transition stays legible.
          const showAiHeader = msg.sender === "ai" && (!isGrouped || prev?.mode !== msg.mode)
          return (
          <motion.div
            key={msg.id}
            layout
            initial={
              settings.accessibilityMode
                ? { opacity: 0 }
                : { opacity: 0, y: 12, x: msg.sender === "user" ? 16 : -16, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
            transition={
              settings.accessibilityMode
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 320, damping: 28, mass: 0.6 }
            }
            className={`${isGrouped ? "mt-0.5" : "mt-3"} flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] ${
                msg.sender === "user"
                  ? "border border-foreground/20 bg-foreground/5 text-foreground"
                  : "border border-border bg-card text-foreground"
              } px-3 py-2`}
            >
              {showAiHeader && (
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {settings.name}
                  </span>
                  {msg.mode === "fallback" && (
                    <span className="rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-amber-300">
                      local fallback
                    </span>
                  )}
                  {msg.mode === "mcp-fallback" && (
                    <span className="rounded border border-cyan-500/50 bg-cyan-500/10 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-cyan-300">
                      mcp fallback
                    </span>
                  )}
                  {msg.emotion && (
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground/60">
                      [{msg.emotion}]
                    </span>
                  )}
                </div>
              )}
              {msg.sender === "ai" ? (
                splitIntoBeats(msg.text).map((beat, beatIndex) => (
                  <motion.p
                    key={beatIndex}
                    // Let the beats arrive in sequence — reflection first, then
                    // a small breath, then the question — so a reply lands like
                    // someone speaking in turns rather than all at once. Reduced
                    // motion shows them together, instantly.
                    initial={
                      settings.accessibilityMode || beatIndex === 0
                        ? false
                        : { opacity: 0, y: 4 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      settings.accessibilityMode
                        ? { duration: 0 }
                        : { duration: 0.25, delay: beatIndex * 0.55, ease: "easeOut" }
                    }
                    className={`text-[12px] leading-relaxed ${beatIndex > 0 ? "mt-1.5" : ""}`}
                  >
                    {beat}
                  </motion.p>
                ))
              ) : (
                <p className="text-[12px] leading-relaxed">{msg.text}</p>
              )}
              <div className={`mt-1 flex items-center gap-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <span className="text-[11px] text-muted-foreground/50">
                  {msg.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </span>
                {msg.sender === "ai" && (
                  <button
                    onClick={() => speak(msg.text)}
                    disabled={!isVoiceEnabled}
                    className="text-muted-foreground/40 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-muted-foreground/40"
                    aria-label="Read message aloud"
                    title={
                      !isVoiceEnabled
                        ? "Voice is muted"
                        : isSpeaking && activeSpeechTextRef.current === msg.text.trim()
                          ? "Stop reading"
                          : "Read message aloud"
                    }
                  >
                    {isVoiceEnabled ? (
                      isSpeaking && activeSpeechTextRef.current === msg.text.trim() ? (
                        <VolumeX className="h-2.5 w-2.5" />
                      ) : (
                        <Volume2 className="h-2.5 w-2.5" />
                      )
                    ) : (
                      <VolumeX className="h-2.5 w-2.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
          )
        })}
        </AnimatePresence>

        <AnimatePresence>
          {isLoading && (
            <motion.div
              key="thinking-indicator"
              layout
              initial={settings.accessibilityMode ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={settings.accessibilityMode ? { duration: 0.15 } : { type: "spring", stiffness: 300, damping: 26 }}
              className="mb-3 flex justify-start"
            >
              <div className="border border-border bg-card px-3 py-2">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {settings.name} {feltState?.load === "high" ? "is here with you" : "is thinking"}
                  </span>
                  <span className="inline-flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="inline-block h-1 w-1 rounded-full bg-muted-foreground"
                        animate={
                          settings.accessibilityMode
                            ? { opacity: 1 }
                            : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }
                        }
                        transition={
                          settings.accessibilityMode
                            ? { duration: 0 }
                            : { duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }
                        }
                      />
                    ))}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative border-t border-border px-4 py-3">
        {messages.length > 0 && feltState && input.trim().length === 0 && !isOnboardingActive && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5" data-testid="felt-prompt-strip">
            <span className="inline-flex items-center gap-1 text-[10px] lowercase tracking-wide text-muted-foreground/70">
              <Sparkles className="h-3 w-3 text-violet-300/70" />
              {feltState.primary
                ? `since you're feeling ${feltState.primary}, maybe`
                : "if it helps, maybe"}
            </span>
            {quickPrompts.map((prompt, index) => (
              <button
                key={prompt}
                onClick={() => applyQuickPrompt(index)}
                className="rounded-full border border-violet-500/20 bg-violet-500/5 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-violet-400/50 hover:bg-violet-500/10 hover:text-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence>
          {harshSignal.flagged && (
            <motion.div
              key={harshSignal.kind}
              initial={settings.accessibilityMode ? { opacity: 0 } : { opacity: 0, y: 6, height: 0 }}
              animate={settings.accessibilityMode ? { opacity: 1 } : { opacity: 1, y: 0, height: "auto" }}
              exit={settings.accessibilityMode ? { opacity: 0 } : { opacity: 0, y: 6, height: 0 }}
              transition={{ duration: 0.18 }}
              className="mb-2 overflow-hidden"
            >
              <div
                role="status"
                aria-live="polite"
                className={`flex items-start gap-2 rounded border px-2.5 py-1.5 text-[11px] leading-snug ${
                  harshSignal.kind === "violent-ideation"
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                    : harshSignal.kind === "self-directed"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                      : "border-sky-500/30 bg-sky-500/10 text-sky-200"
                }`}
              >
                <HeartHandshake className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{harshSignal.message}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {micError && (
          <div
            role="status"
            aria-live="polite"
            className="mb-2 flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-200"
          >
            <MicOff className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{micError}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {speechSupported && (
            <button
              onClick={toggleListening}
              className={`flex h-8 w-8 items-center justify-center border transition-colors ${
                isListening
                  ? "animate-pulse border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              aria-label={isListening ? "Stop listening" : "Start voice input"}
              title={isListening ? "Listening… click to stop" : "Speak instead of typing"}
            >
              {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
          )}

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => inputRef.current?.select()}
            placeholder="Share your thoughts..."
            autoFocus
            className="flex-1 border border-border bg-card px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring focus:border-foreground transition-all"
            autoComplete="off"
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex h-8 w-8 items-center justify-center border border-border bg-card text-muted-foreground transition-colors hover:bg-foreground hover:text-background disabled:opacity-30 disabled:hover:bg-card disabled:hover:text-muted-foreground"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </button>

          {settings.accessibilityMode && (
            <button
              onClick={() => setShowShortcutHelp((prev) => !prev)}
              className="flex h-8 w-8 items-center justify-center border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Show keyboard shortcuts"
              title="Keyboard shortcuts"
            >
              ?
            </button>
          )}
        </div>

        {settings.accessibilityMode && (
          <div className="mt-2 text-[11px] text-muted-foreground/70">
            Shortcuts: <span className="text-foreground">Alt+1/2/3</span> quick prompts, <span className="text-foreground">/</span> focus input, <span className="text-foreground">?</span> help.
          </div>
        )}

        {settings.accessibilityMode && showShortcutHelp && (
          <div className="absolute bottom-14 right-4 z-20 w-72 rounded border border-border bg-card p-3 text-[11px] text-muted-foreground shadow-lg">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">Keyboard Shortcuts</div>
            <div className="space-y-1">
              <div><span className="text-foreground">Alt+1 / Alt+2 / Alt+3</span> - Insert quick prompt</div>
              <div><span className="text-foreground">/</span> - Focus message input</div>
              <div><span className="text-foreground">?</span> - Toggle this help</div>
              <div><span className="text-foreground">Esc</span> - Emergency mute and close help</div>
            </div>
          </div>
        )}

        {isListening && (
          <div className="mt-2 flex items-center justify-center gap-1">
            {[...Array(12)].map((_, i) => (
              <span
                key={i}
                className="inline-block w-0.5 bg-foreground"
                style={{
                  animation: `waveform 0.8s ${i * 0.06}s ease-in-out infinite`,
                  height: "4px",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
