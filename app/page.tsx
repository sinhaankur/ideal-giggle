"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { Settings } from "lucide-react"
import { CameraPanel } from "@/components/camera-panel"
import { ChatPanel } from "@/components/chat-panel"
import { EmpathyPanel } from "@/components/empathy-panel"
import { SettingsPanel } from "@/components/settings-panel"
import { SetupChecklist } from "@/components/setup-checklist"
import {
  DEFAULT_SETTINGS,
  DEFAULT_EMPATHY_PROFILE,
  detectEmotion,
  analyzeEmpathy,
  generateEmpathyCode,
  type Emotion,
  type EmpathyData,
  type EmpathyProfile,
  type CompanionSettings,
  type Message,
} from "@/lib/companion-types"

function buildSystemPrompt(
  companionName: string,
  personality: CompanionSettings["personality"],
  emotion: Emotion,
  empathyProfile: EmpathyProfile,
  empathyCode: string
) {
  const personalityPrompts: Record<CompanionSettings["personality"], string> = {
    warm: `You are ${companionName}, a deeply empathetic and warm AI companion. You truly care about the person you're talking to. You pick up on emotional cues, validate feelings, and offer genuine comfort. You speak naturally, with warmth and tenderness -- like a close friend who truly understands. You are creative, sometimes sharing metaphors, poetry fragments, or beautiful observations about life.`,
    analytical: `You are ${companionName}, a thoughtful and analytical AI companion. You help people understand their emotions through clear reasoning and gentle observation. You offer structured perspectives while remaining caring. You sometimes use frameworks or models to help people think through their feelings, but always with compassion.`,
    playful: `You are ${companionName}, a playful and creative AI companion. You use humor, wordplay, and imaginative thinking to help people feel lighter. You're like a creative muse who can turn any conversation into something beautiful. You still take emotions seriously, but you know that laughter and creativity are powerful healers.`,
    professional: `You are ${companionName}, a composed and direct AI companion. You provide clear, honest emotional support without unnecessary fluff. You respect the person's time and intelligence. You're like a wise counselor who gets to the heart of things quickly while maintaining genuine care.`,
  }

  return `${personalityPrompts[personality]}

Current detected emotion from the user: ${emotion}. Adjust your response tone accordingly.

User empathy profile:
- Preferred name: ${empathyProfile.preferredName}
- Communication style: ${empathyProfile.communicationStyle}
- Support goals: ${empathyProfile.supportGoals.join("; ") || "Not specified"}
- Negative thought patterns: ${empathyProfile.negativeThoughtPatterns.join("; ") || "Not specified"}
- Reframe preferences: ${empathyProfile.reframePreferences.join("; ") || "Not specified"}
- Grounding prompts: ${empathyProfile.groundingPrompts.join("; ") || "Not specified"}
- Phrases to avoid: ${empathyProfile.avoidPhrases.join("; ") || "Not specified"}
- Empathy code: ${empathyCode || "Not generated yet"}

Guidelines:
- Be genuinely empathetic -- mirror and validate emotions before offering perspective
- Help the user rethink and re-evaluate negative thoughts with compassionate cognitive reframing
- Be creative -- occasionally use metaphors, analogies, or artistic observations
- Keep responses conversational and human-like (2-4 sentences typically)
- Never diagnose or provide medical/psychological advice
- If someone seems in crisis, gently suggest professional resources
- Remember context from the conversation to show you truly listen`
}

export default function CompanionApp() {
  const agreementStorageKey = "empatheia_user_agreement_v1"
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
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>("neutral")
  const [empathyProfile, setEmpathyProfile] = useState<EmpathyProfile>(DEFAULT_EMPATHY_PROFILE)
  const introQuestions = [
    "What usually triggers your negative thoughts?",
    "What kind of support tone helps you most?",
    "Which thought pattern shows up most often?",
    "What helps you feel grounded quickly?",
  ]
  const [introAnswers, setIntroAnswers] = useState<string[]>(Array(4).fill(""))
  const [empathyCode, setEmpathyCode] = useState("")
  const [mobilePanel, setMobilePanel] = useState<"camera" | "chat" | "empathy">("chat")
  const [hasAgreed, setHasAgreed] = useState(false)
  const [agreementChecked, setAgreementChecked] = useState(false)
  const [webLlmMessages, setWebLlmMessages] = useState<Message[]>([])
  const [isWebLlmLoading, setIsWebLlmLoading] = useState(false)
  const [isInitializingWebLlm, setIsInitializingWebLlm] = useState(false)
  const [webLlmStatus, setWebLlmStatus] = useState("idle")
  const [webLlmProgress, setWebLlmProgress] = useState("")
  const [webLlmError, setWebLlmError] = useState("")
  const [llmConnectionError, setLlmConnectionError] = useState("")

  const webLlmMessagesRef = useRef<Message[]>([])
  const webLlmEngineRef = useRef<any>(null)
  const webLlmInitPromiseRef = useRef<Promise<any> | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const agreed = window.localStorage.getItem(agreementStorageKey) === "accepted"
    setHasAgreed(agreed)
  }, [agreementStorageKey])

  useEffect(() => {
    webLlmMessagesRef.current = webLlmMessages
  }, [webLlmMessages])

  useEffect(() => {
    webLlmEngineRef.current = null
    webLlmInitPromiseRef.current = null
    setWebLlmStatus("idle")
    setWebLlmProgress("")
    setWebLlmError("")
    setLlmConnectionError("")
  }, [settings.webllmModel])

  const { messages: chatMessages, sendMessage, status, error: remoteError } = useChat({
    api: chatApi,
    body: {
      emotion: currentEmotion,
      personality: settings.personality,
      provider: settings.provider,
      temperature: settings.temperature,
      companionName: settings.name,
      empathyProfile,
      empathyCode,
      ollamaBaseUrl: settings.ollamaBaseUrl,
      ollamaModel: settings.ollamaModel,
      openRouterApiKey: settings.openRouterApiKey,
      openRouterModel: settings.openRouterModel,
      topP: settings.topP,
      maxOutputTokens: settings.maxOutputTokens,
      contextMessages: settings.contextMessages,
    },
  })

  const isRemoteLoading = status === "streaming" || status === "submitted"
  const isLoading = settings.provider === "webllm" ? isWebLlmLoading : isRemoteLoading

  useEffect(() => {
    if (remoteError?.message) {
      setLlmConnectionError(remoteError.message)
    }
  }, [remoteError])

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
      if (typeof navigator === "undefined" || !("gpu" in navigator)) {
        throw new Error("WebLLM needs WebGPU in this browser. Connect an API provider from Settings, or use a WebGPU-enabled browser.")
      }

      const webllm = await import("@mlc-ai/web-llm")
      const engine = await webllm.CreateMLCEngine(settings.webllmModel, {
        initProgressCallback(report) {
          const progressValue =
            typeof report.progress === "number"
              ? `${Math.round(report.progress * 100)}%`
              : ""
          const progressText = report.text ? ` ${report.text}` : ""
          setWebLlmProgress(`${progressValue}${progressText}`.trim())
        },
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
      setLlmConnectionError("LLM is not connected. Open Settings and connect an API model.")
      throw error
    } finally {
      webLlmInitPromiseRef.current = null
    }
  }, [settings.webllmModel])

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

  const handleConnectLlmApi = useCallback(() => {
    setSettings((prev) =>
      prev.provider === "webllm"
        ? { ...prev, provider: "openrouter" }
        : prev
    )
    setShowSettings(true)
  }, [])

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
      })),
    [chatMessages, currentEmotion]
  )

  const messages = settings.provider === "webllm" ? webLlmMessages : remoteMessages

  const generateCurrentEmpathyCode = useCallback(() => {
    const code = generateEmpathyCode({
      profile: empathyProfile,
      empathyData,
      introAnswers,
    })
    setEmpathyCode(code)
  }, [empathyProfile, empathyData, introAnswers])

  const handleIntroAnswerChange = useCallback((index: number, answer: string) => {
    setIntroAnswers((prev) => {
      const next = [...prev]
      next[index] = answer
      return next
    })
  }, [])

  useEffect(() => {
    const introComplete = introAnswers.every((ans) => ans.trim().length > 1)
    if (!empathyCode && introComplete && messages.length >= 6) {
      generateCurrentEmpathyCode()
    }
  }, [introAnswers, messages.length, empathyCode, generateCurrentEmpathyCode])

  const handleSendMessage = useCallback(
    async (text: string) => {
      setLlmConnectionError("")

      // Detect emotion from text
      const textEmotion = detectEmotion(text)
      // Combine with camera emotion (prefer text if not neutral)
      const combinedEmotion = textEmotion !== "neutral" ? textEmotion : cameraEmotion
      setCurrentEmotion(combinedEmotion)

      // Update empathy map
      setEmpathyData((prev) => analyzeEmpathy(text, prev))

      if (settings.provider === "webllm") {
        const userMessage: Message = {
          id: crypto.randomUUID(),
          text,
          sender: "user",
          timestamp: new Date(),
          emotion: combinedEmotion,
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
                  combinedEmotion,
                  empathyProfile,
                  empathyCode
                ),
              },
              ...conversation,
            ],
            temperature: settings.temperature,
            top_p: settings.topP,
            max_tokens: settings.maxOutputTokens,
          })

          const aiContentRaw = completion.choices?.[0]?.message?.content
          const aiText =
            typeof aiContentRaw === "string"
              ? aiContentRaw
              : Array.isArray(aiContentRaw)
                ? aiContentRaw
                    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
                    .join("")
                : ""

          const aiMessage: Message = {
            id: crypto.randomUUID(),
            text: aiText || "I am here with you. Could you tell me a little more?",
            sender: "ai",
            timestamp: new Date(),
            emotion: combinedEmotion,
          }

          setWebLlmMessages((prev) => [...prev, aiMessage])
          setWebLlmStatus("ready")
          setLlmConnectionError("")
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown WebLLM error"
          setWebLlmStatus("error")
          setWebLlmError(message)
          setLlmConnectionError("WebLLM is unavailable. Open Settings and connect an API provider.")
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
      }
    },
    [
      cameraEmotion,
      sendMessage,
      settings,
      ensureWebLlmEngine,
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
            <span className="h-2 w-2 rounded-full bg-foreground animate-pulse" />
            <span className="text-sm text-muted-foreground">
              System Active
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
                    ? "GPT-4o Mini"
                    : settings.provider === "anthropic"
                      ? "Claude 3.5"
                      : settings.provider === "google"
                        ? "Gemini 2.0"
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Personality</span>
                <span className="text-foreground uppercase">{settings.personality}</span>
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

          <SetupChecklist settings={settings} />

          {/* Decorative retro element */}
          <div className="mt-4 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-1 flex-1 bg-muted-foreground/10"
                  style={{
                    opacity: i < Math.ceil(8 * (currentEmotion === "neutral" ? 0.3 : 0.7)),
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

        {/* Right Panel - Empathy Map */}
        <aside
          className={`w-full flex-shrink-0 overflow-y-auto border-l border-border p-4 md:w-72 lg:w-80 ${
            mobilePanel === "empathy" ? "block" : "hidden md:block"
          }`}
        >
          <EmpathyPanel
            data={empathyData}
            profile={empathyProfile}
            onProfileImport={handleProfileImport}
            onProfileExport={handleProfileExport}
            introQuestions={introQuestions}
            introAnswers={introAnswers}
            onIntroAnswerChange={handleIntroAnswerChange}
            empathyCode={empathyCode}
            onGenerateEmpathyCode={generateCurrentEmpathyCode}
            messageCount={messages.length}
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
