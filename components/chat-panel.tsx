"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Send, Mic, MicOff, Volume2 } from "lucide-react"
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Setup speech recognition
  useEffect(() => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = "en-US"

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
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

  // Text-to-speech for AI responses
  const speak = useCallback((text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      utterance.pitch = 1.1
      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      window.speechSynthesis.speak(utterance)
    }
  }, [])

  // Auto-speak latest AI message
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.sender === "ai") {
      speak(last.text)
    }
  }, [messages, speak])

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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-[0.2em] text-foreground">
            {settings.name}
          </span>
          <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
            {settings.personality} -- {settings.provider === "local" ? "LOCAL LLM" : settings.provider === "cloud" ? "CLOUD AI" : "HYBRID"}
          </span>
        </div>
        <div className="flex items-center gap-2">
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
                    className="text-muted-foreground/40 transition-colors hover:text-foreground"
                    aria-label="Read message aloud"
                  >
                    <Volume2 className="h-2.5 w-2.5" />
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
            placeholder="Share your thoughts..."
            className="flex-1 border border-border bg-card px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
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
