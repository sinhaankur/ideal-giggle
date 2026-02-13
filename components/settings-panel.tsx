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
      value: "openai",
      label: "OpenAI",
      desc: "GPT-4o Mini -- Advanced reasoning",
      icon: Cloud,
    },
    {
      value: "anthropic",
      label: "Anthropic",
      desc: "Claude 3.5 Sonnet -- Thoughtful communication",
      icon: Cloud,
    },
    {
      value: "google",
      label: "Google",
      desc: "Gemini 2.0 Flash -- Fast and capable",
      icon: Cloud,
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
      <div className="mx-4 flex max-h-[90vh] w-full max-w-md flex-col border border-border bg-card rounded-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-foreground" />
            <span className="text-base font-semibold text-foreground">
              Settings
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Companion Name */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <User className="h-4 w-4 text-foreground" />
              <span className="text-sm font-semibold text-foreground">
                Identity
              </span>
            </div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Companion Name
            </label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => update({ name: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g., Samantha, Echo, Sage"
            />
          </div>

          {/* Personality */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <Sparkles className="h-4 w-4 text-foreground" />
              <span className="text-sm font-semibold text-foreground">
                Personality
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {personalities.map((p) => (
                <button
                  key={p.value}
                  onClick={() => update({ personality: p.value })}
                  className={`flex flex-col items-start rounded border p-3 text-left text-sm transition-colors ${
                    settings.personality === p.value
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <span className="text-sm font-bold text-foreground">
                    {p.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AI Provider */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <Server className="h-4 w-4 text-foreground" />
              <span className="text-sm font-semibold text-foreground">
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
                    className={`flex items-center gap-3 rounded border p-3 text-left transition-colors ${
                      settings.provider === p.value
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <Icon className="h-4 w-4 text-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-foreground">
                        {p.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{p.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Local LLM Settings */}
          {/* Settings removed - direct API providers are now used */}

          {/* Cloud Settings */}
          {/* Settings removed - direct API providers are now used */}

          {/* Temperature */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <Thermometer className="h-4 w-4 text-foreground" />
              <span className="text-sm font-semibold text-foreground">
                Creativity
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Focused</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.temperature}
                onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
                className="flex-1 accent-foreground"
              />
              <span className="text-sm text-muted-foreground">Creative</span>
            </div>
            <div className="mt-2 text-center text-base font-semibold text-foreground">
              {settings.temperature.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-3">
          <button
            onClick={onClose}
            className="w-full rounded border border-foreground bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  )
}
