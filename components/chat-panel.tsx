"use client"

import { useRef, useState, useEffect, useCallback, useMemo } from "react"
import { Send, Mic, MicOff, Volume2, VolumeX, BellOff, AlertTriangle, Wrench } from "lucide-react"
import { AIOrb } from "@/components/ai-orb"
import type { Message, Emotion, CompanionSettings } from "@/lib/companion-types"

interface ChatPanelProps {
  messages: Message[]
  onSendMessage: (text: string) => void
  isLoading: boolean
  emotion: Emotion
  settings: CompanionSettings
  connectionError?: string
  systemHealth?: "ready" | "busy" | "fallback" | "initializing"
  webLlmStatus?: string
  introProgress?: { answered: number; total: number }
  onOpenSettings?: () => void
}

export function ChatPanel({
  messages,
  onSendMessage,
  isLoading,
  emotion,
  settings,
  connectionError,
  systemHealth,
  webLlmStatus,
  introProgress,
  onOpenSettings,
}: ChatPanelProps) {
  const [input, setInput] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const activeSpeechTextRef = useRef("")
  const lastSpeechRequestRef = useRef<{ text: string; at: number }>({ text: "", at: 0 })
  const [uiNow, setUiNow] = useState(Date.now())
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)

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
      }
    }
  }, [messages])

  // Setup speech recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const win = window as Window & {
        SpeechRecognition?: new () => any
        webkitSpeechRecognition?: new () => any
      }

      const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition
      if (!SpeechRecognition) return

      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = "en-US"

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("")
        setInput(transcript)
        if (event.results[0].isFinal) {
          setIsListening(false)
        }
      }

      recognition.onerror = () => {
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }
  }, [])

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }, [isListening])

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
    utterance.rate = 0.9
    utterance.pitch = 1.1
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
  }, [isSpeaking, isVoiceEnabled, stopSpeaking])

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
    onSendMessage(text)
    setInput("")
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const providerLabel =
    settings.provider === "webllm"
      ? "BROWSER LOCAL"
      : settings.provider === "ollama"
        ? "OLLAMA LOCAL"
        : settings.provider.toUpperCase()

  const introTotal = introProgress?.total || 0
  const introAnswered = introProgress?.answered || 0
  const isOnboardingActive = introTotal > 0 && introAnswered < introTotal
  const onboardingPercent = introTotal > 0 ? Math.round((introAnswered / introTotal) * 100) : 0

  const fallbackActive = systemHealth === "fallback" || Boolean(connectionError)
  const statusBannerText = fallbackActive
    ? connectionError || "Model connection is unstable. Local fallback responses are active."
    : systemHealth === "initializing"
      ? settings.provider === "webllm"
        ? `Initializing WebLLM (${webLlmStatus || "starting"})...`
        : "Preparing provider runtime..."
      : ""

  const quickPrompts = useMemo(
    () =>
      isOnboardingActive
        ? [
            "I feel anxious because I am overloaded.",
            "The trigger was a conflict at work.",
            "My body feels tight in my chest.",
          ]
        : ["Is AI running?", "Help me calm down in 2 steps.", "Summarize what you understood about me."],
    [isOnboardingActive]
  )

  const applyQuickPrompt = useCallback((index: number) => {
    const prompt = quickPrompts[index]
    if (!prompt) return
    setInput(prompt)
    inputRef.current?.focus()
  }, [quickPrompts])

  useEffect(() => {
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
  }, [applyQuickPrompt, emergencyMute])

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
          <span className="text-xs uppercase tracking-[0.2em] text-foreground">
            {settings.name}
          </span>
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            {settings.personality} -- {providerLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={emergencyMute}
            className="flex h-6 items-center gap-1 border border-destructive/50 bg-destructive/10 px-2 text-[10px] uppercase tracking-[0.12em] text-destructive transition-colors hover:bg-destructive/20"
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
          <span className={`h-1.5 w-1.5 rounded-full ${isLoading ? "animate-pulse bg-muted-foreground" : "bg-foreground"}`} />
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            {isLoading ? "THINKING" : "ONLINE"}
          </span>
        </div>
      </div>

      {/* AI Orb Visualization */}
      <div className="flex items-center justify-center border-b border-border py-6">
        <AIOrb
          isListening={isListening}
          isSpeaking={isSpeaking}
          emotion={emotion}
          phase={orbPhase}
          activityLevel={orbActivity}
          intensity={orbActivity}
        />
      </div>

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
                className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-accent"
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
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
              Begin Conversation
            </div>
            <div className="max-w-[240px] text-[11px] leading-relaxed text-muted-foreground/40">
              Share your thoughts, feelings, or whatever is on your mind. I am here to listen and understand.
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              {quickPrompts.map((prompt, index) => (
                <button
                  key={prompt}
                  onClick={() => applyQuickPrompt(index)}
                  className="rounded border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-3 flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] ${
                msg.sender === "user"
                  ? "border border-foreground/20 bg-foreground/5 text-foreground"
                  : "border border-border bg-card text-foreground"
              } px-3 py-2`}
            >
              {msg.sender === "ai" && (
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {settings.name}
                  </span>
                  {msg.mode === "fallback" && (
                    <span className="rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-amber-300">
                      local fallback
                    </span>
                  )}
                  {msg.mode === "mcp-fallback" && (
                    <span className="rounded border border-cyan-500/50 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-cyan-300">
                      mcp fallback
                    </span>
                  )}
                  {msg.emotion && (
                    <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
                      [{msg.emotion}]
                    </span>
                  )}
                </div>
              )}
              <p className="text-[12px] leading-relaxed">{msg.text}</p>
              <div className={`mt-1 flex items-center gap-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <span className="text-[10px] text-muted-foreground/50">
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
          </div>
        ))}

        {isLoading && (
          <div className="mb-3 flex justify-start">
            <div className="border border-border bg-card px-3 py-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {settings.name} is thinking
                </span>
                <span className="inline-flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="inline-block h-1 w-1 rounded-full bg-muted-foreground"
                      style={{
                        animation: `typing-dots 1.2s ${i * 0.2}s ease-in-out infinite`,
                      }}
                    />
                  ))}
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative border-t border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleListening}
            className={`flex h-8 w-8 items-center justify-center border transition-colors ${
              isListening
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            aria-label={isListening ? "Stop listening" : "Start voice input"}
          >
            {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>

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

          <button
            onClick={() => setShowShortcutHelp((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Show keyboard shortcuts"
            title="Keyboard shortcuts"
          >
            ?
          </button>
        </div>

        <div className="mt-2 text-[10px] text-muted-foreground/70">
          Shortcuts: <span className="text-foreground">Alt+1/2/3</span> quick prompts, <span className="text-foreground">/</span> focus input, <span className="text-foreground">?</span> help.
        </div>

        {showShortcutHelp && (
          <div className="absolute bottom-14 right-4 z-20 w-72 rounded border border-border bg-card p-3 text-[11px] text-muted-foreground shadow-lg">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">Keyboard Shortcuts</div>
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
