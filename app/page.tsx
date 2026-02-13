"use client"

import { useState, useCallback, useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Settings, Menu, X } from "lucide-react"
import { CameraPanel } from "@/components/camera-panel"
import { ChatPanel } from "@/components/chat-panel"
import { EmpathyPanel } from "@/components/empathy-panel"
import { SettingsPanel } from "@/components/settings-panel"
import {
  DEFAULT_SETTINGS,
  detectEmotion,
  analyzeEmpathy,
  type Emotion,
  type EmpathyData,
  type CompanionSettings,
  type Message,
} from "@/lib/companion-types"

export default function CompanionApp() {
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
  const [mobilePanel, setMobilePanel] = useState<"camera" | "chat" | "empathy">("chat")

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: {
            id,
            messages,
            emotion: currentEmotion,
            personality: settings.personality,
            provider: settings.provider,
            temperature: settings.temperature,
            companionName: settings.name,
          },
        }),
      }),
    [currentEmotion, settings.personality, settings.provider, settings.temperature, settings.name]
  )

  const { messages: chatMessages, sendMessage, status } = useChat({ transport })

  const isLoading = status === "streaming" || status === "submitted"

  // Convert AI SDK UIMessage format to our Message format for the ChatPanel
  const messages: Message[] = useMemo(
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

  const handleSendMessage = useCallback(
    (text: string) => {
      // Detect emotion from text
      const textEmotion = detectEmotion(text)
      // Combine with camera emotion (prefer text if not neutral)
      const combinedEmotion = textEmotion !== "neutral" ? textEmotion : cameraEmotion
      setCurrentEmotion(combinedEmotion)

      // Update empathy map
      setEmpathyData((prev) => analyzeEmpathy(text, prev))

      // Send via AI SDK
      sendMessage({ text })
    },
    [cameraEmotion, sendMessage]
  )

  const handleCameraEmotion = useCallback((emotion: Emotion) => {
    setCameraEmotion(emotion)
  }, [])

  const handleDeviceChange = useCallback(
    (deviceId: string) => {
      setSettings((prev) => ({ ...prev, cameraDeviceId: deviceId }))
    },
    []
  )

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-foreground">
              Empatheia
            </span>
            <span className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
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
              className={`px-2 py-1 text-[9px] uppercase tracking-[0.1em] ${
                mobilePanel === panel
                  ? "bg-foreground text-background"
                  : "text-muted-foreground"
              }`}
            >
              {panel}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-pulse-glow" />
            <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
              System Active
            </span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 border border-border px-2 py-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Open settings"
          >
            <Settings className="h-3 w-3" />
            <span className="hidden md:inline">Config</span>
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
          <div className="mt-4 border border-border bg-card p-3">
            <div className="mb-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              System Status
            </div>
            <div className="flex flex-col gap-1.5 text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider</span>
                <span className="text-foreground uppercase">
                  {settings.provider}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="font-mono text-foreground">
                  {settings.provider === "local" ? settings.localModel : settings.cloudModel.split("/")[1]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Personality</span>
                <span className="text-foreground uppercase">{settings.personality}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Temp</span>
                <span className="text-foreground">{settings.temperature}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Emotion</span>
                <span className="text-foreground uppercase">{currentEmotion}</span>
              </div>
            </div>
          </div>

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
          <EmpathyPanel data={empathyData} />
        </aside>
      </div>

      {/* Bottom Status Bar */}
      <footer className="flex items-center justify-between border-t border-border px-4 py-1.5 md:px-6">
        <span className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40">
          Empatheia -- Powered by Local AI & Cloud
        </span>
        <span className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/40">
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
