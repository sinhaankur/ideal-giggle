"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Send, Mic, MicOff, Volume2, VolumeX, BellOff } from "lucide-react"
import { AIOrb } from "@/components/ai-orb"
import type { Message, Emotion, CompanionSettings } from "@/lib/companion-types"

interface ChatPanelProps {
  messages: Message[]
  onSendMessage: (text: string) => void
  isLoading: boolean
  emotion: Emotion
  settings: CompanionSettings
}

export function ChatPanel({ messages, onSendMessage, isLoading, emotion, settings }: ChatPanelProps) {
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        emergencyMute()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [emergencyMute])

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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-[0.2em] text-foreground">
            {settings.name}
          </span>
          <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
            {settings.personality} -- {providerLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={emergencyMute}
            className="flex h-6 items-center gap-1 border border-destructive/50 bg-destructive/10 px-2 text-[9px] uppercase tracking-[0.12em] text-destructive transition-colors hover:bg-destructive/20"
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
          <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
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
          intensity={isLoading ? 0.8 : isSpeaking ? 0.9 : isListening ? 0.7 : 0.4}
        />
      </div>

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
                  <span className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                    {settings.name}
                  </span>
                  {msg.mode === "fallback" && (
                    <span className="rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.12em] text-amber-300">
                      local fallback
                    </span>
                  )}
                  {msg.mode === "mcp-fallback" && (
                    <span className="rounded border border-cyan-500/50 bg-cyan-500/10 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.12em] text-cyan-300">
                      mcp fallback
                    </span>
                  )}
                  {msg.emotion && (
                    <span className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/60">
                      [{msg.emotion}]
                    </span>
                  )}
                </div>
              )}
              <p className="text-[12px] leading-relaxed">{msg.text}</p>
              <div className={`mt-1 flex items-center gap-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <span className="text-[8px] text-muted-foreground/40">
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
                <span className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
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
      <div className="border-t border-border px-4 py-3">
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
        </div>

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
