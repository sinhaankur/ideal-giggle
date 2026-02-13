"use client"

import { Settings, Server, Cloud, Zap, Thermometer, User, Sparkles } from "lucide-react"
import type { CompanionSettings, AIProvider, Personality } from "@/lib/companion-types"

interface SettingsPanelProps {
  settings: CompanionSettings
  onSettingsChange: (settings: CompanionSettings) => void
  onClose: () => void
}

export function SettingsPanel({ settings, onSettingsChange, onClose }: SettingsPanelProps) {
  const update = (partial: Partial<CompanionSettings>) => {
    onSettingsChange({ ...settings, ...partial })
  }

  const providers: { value: AIProvider; label: string; desc: string; icon: typeof Server }[] = [
    {
      value: "local",
      label: "LOCAL LLM",
      desc: "Ollama -- Private, on-device inference",
      icon: Server,
    },
    {
      value: "cloud",
      label: "CLOUD AI",
      desc: "OpenAI / Cloud -- Faster, external",
      icon: Cloud,
    },
    {
      value: "hybrid",
      label: "HYBRID",
      desc: "Local-first, cloud fallback",
      icon: Zap,
    },
  ]

  const personalities: { value: Personality; label: string; desc: string }[] = [
    { value: "warm", label: "WARM", desc: "Empathetic and caring" },
    { value: "analytical", label: "ANALYTICAL", desc: "Logical and precise" },
    { value: "playful", label: "PLAYFUL", desc: "Creative and fun" },
    { value: "professional", label: "DIRECT", desc: "Professional and concise" },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-lg flex-col border border-border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs uppercase tracking-[0.2em] text-foreground">
              Configuration
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground"
          >
            [CLOSE]
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Companion Name */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Identity
              </span>
            </div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Companion Name
            </label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => update({ name: e.target.value })}
              className="w-full border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="e.g., Samantha, Echo, Sage"
            />
          </div>

          {/* Personality */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <Sparkles className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Personality
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {personalities.map((p) => (
                <button
                  key={p.value}
                  onClick={() => update({ personality: p.value })}
                  className={`flex flex-col items-start border p-3 text-left transition-colors ${
                    settings.personality === p.value
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground">
                    {p.label}
                  </span>
                  <span className="text-[9px] text-muted-foreground">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AI Provider */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <Server className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                AI Provider
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {providers.map((p) => {
                const Icon = p.icon
                return (
                  <button
                    key={p.value}
                    onClick={() => update({ provider: p.value })}
                    className={`flex items-center gap-3 border p-3 text-left transition-colors ${
                      settings.provider === p.value
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground">
                        {p.label}
                      </span>
                      <span className="text-[9px] text-muted-foreground">{p.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Local LLM Settings */}
          {(settings.provider === "local" || settings.provider === "hybrid") && (
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                <Server className="h-3 w-3 text-muted-foreground" />
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                  Local LLM Config
                </span>
              </div>
              <div className="mb-3">
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Ollama Endpoint
                </label>
                <input
                  type="text"
                  value={settings.localEndpoint}
                  onChange={(e) => update({ localEndpoint: e.target.value })}
                  className="w-full border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="http://localhost:11434"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Model
                </label>
                <select
                  value={settings.localModel}
                  onChange={(e) => update({ localModel: e.target.value })}
                  className="w-full border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="mistral" className="bg-card text-foreground">Mistral</option>
                  <option value="llama2" className="bg-card text-foreground">Llama 2</option>
                  <option value="neural-chat" className="bg-card text-foreground">Neural Chat</option>
                  <option value="codellama" className="bg-card text-foreground">Code Llama</option>
                  <option value="phi" className="bg-card text-foreground">Phi-2</option>
                </select>
              </div>
            </div>
          )}

          {/* Cloud Settings */}
          {(settings.provider === "cloud" || settings.provider === "hybrid") && (
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                <Cloud className="h-3 w-3 text-muted-foreground" />
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                  Cloud Config
                </span>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Model
                </label>
                <select
                  value={settings.cloudModel}
                  onChange={(e) => update({ cloudModel: e.target.value })}
                  className="w-full border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="openai/gpt-4o-mini" className="bg-card text-foreground">GPT-4o Mini</option>
                  <option value="openai/gpt-4o" className="bg-card text-foreground">GPT-4o</option>
                  <option value="anthropic/claude-sonnet-4-20250514" className="bg-card text-foreground">Claude Sonnet</option>
                </select>
              </div>
            </div>
          )}

          {/* Temperature */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <Thermometer className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Creativity
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] text-muted-foreground">Focused</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.temperature}
                onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
                className="flex-1 accent-foreground"
              />
              <span className="text-[9px] text-muted-foreground">Creative</span>
            </div>
            <div className="mt-1 text-center text-[10px] text-muted-foreground">
              {settings.temperature}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="w-full border border-foreground bg-foreground px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-background transition-colors hover:bg-foreground/90"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  )
}
