"use client"

import { Settings, Server, Cloud, Thermometer, User, Sparkles, Cpu, Download } from "lucide-react"
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

  const webLlmModelPresets = [
    "Llama-3.2-1B-Instruct-q4f32_1-MLC",
    "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    "Phi-3.5-mini-instruct-q4f16_1-MLC",
  ]

  const openRouterModelPresets = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-r1-distill-llama-70b:free",
    "qwen/qwen-2.5-72b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
    "google/gemma-2-9b-it:free",
  ]

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
    {
      value: "webllm",
      label: "WebLLM",
      desc: "Runs in your browser and downloads model locally",
      icon: Cpu,
    },
    {
      value: "ollama",
      label: "Ollama",
      desc: "Uses your local Ollama runtime",
      icon: Cpu,
    },
    {
      value: "openrouter",
      label: "OpenRouter (OSS API)",
      desc: "Hosted open-source models via API",
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

          {/* WebLLM Settings */}
          {settings.provider === "webllm" && (
            <div className="mb-6 rounded border border-border bg-background p-3">
              <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                <Cpu className="h-4 w-4 text-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  WebLLM (Browser Local)
                </span>
              </div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                WebLLM Model
              </label>
              <select
                value={webLlmModelPresets.includes(settings.webllmModel) ? settings.webllmModel : "custom"}
                onChange={(e) => {
                  if (e.target.value !== "custom") {
                    update({ webllmModel: e.target.value })
                  }
                }}
                className="mb-2 w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {webLlmModelPresets.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
                <option value="custom">Custom model id</option>
              </select>
              <input
                type="text"
                value={settings.webllmModel}
                onChange={(e) => update({ webllmModel: e.target.value })}
                className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Enter or paste model id"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                First run downloads model files in-browser, then chats fully local.
              </p>
            </div>
          )}

          {/* Ollama Settings */}
          {settings.provider === "ollama" && (
            <div className="mb-6 rounded border border-border bg-background p-3">
              <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                <Cpu className="h-4 w-4 text-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  Ollama (Local Runtime)
                </span>
              </div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Ollama Base URL
              </label>
              <input
                type="text"
                value={settings.ollamaBaseUrl}
                onChange={(e) => update({ ollamaBaseUrl: e.target.value })}
                className="mb-3 w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="http://127.0.0.1:11434"
              />
              <label className="mb-2 block text-sm font-medium text-foreground">
                Ollama Model
              </label>
              <input
                type="text"
                value={settings.ollamaModel}
                onChange={(e) => update({ ollamaModel: e.target.value })}
                className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="llama3.2"
              />
              <div className="mt-3 rounded border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                Browser apps cannot install Ollama automatically. Install it once on your OS, run model pull locally, then this app can connect.
              </div>
              <a
                href="https://ollama.com/download"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded border border-foreground px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-foreground hover:text-background"
              >
                <Download className="h-3.5 w-3.5" />
                Open Ollama Download
              </a>
            </div>
          )}

          {/* OpenRouter Settings */}
          {settings.provider === "openrouter" && (
            <div className="mb-6 rounded border border-border bg-background p-3">
              <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                <Cloud className="h-4 w-4 text-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  OpenRouter (Open-Source Models)
                </span>
              </div>

              <label className="mb-2 block text-sm font-medium text-foreground">
                OpenRouter API Key
              </label>
              <input
                type="password"
                value={settings.openRouterApiKey}
                onChange={(e) => update({ openRouterApiKey: e.target.value })}
                className="mb-3 w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="sk-or-v1-..."
              />

              <label className="mb-2 block text-sm font-medium text-foreground">
                OpenRouter Model
              </label>
              <select
                value={openRouterModelPresets.includes(settings.openRouterModel) ? settings.openRouterModel : "custom"}
                onChange={(e) => {
                  if (e.target.value !== "custom") {
                    update({ openRouterModel: e.target.value })
                  }
                }}
                className="mb-2 w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {openRouterModelPresets.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
                <option value="custom">Custom model id</option>
              </select>

              <input
                type="text"
                value={settings.openRouterModel}
                onChange={(e) => update({ openRouterModel: e.target.value })}
                className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="meta-llama/llama-3.3-70b-instruct:free"
              />

              <p className="mt-2 text-xs text-muted-foreground">
                Uses OpenRouter hosted APIs for open-source models. You can also set OPENROUTER_API_KEY on your server.
              </p>
            </div>
          )}

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

          {/* Advanced Generation Settings */}
          <div className="mb-6 rounded border border-border bg-background p-3">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <Sparkles className="h-4 w-4 text-foreground" />
              <span className="text-sm font-semibold text-foreground">
                Advanced Generation
              </span>
            </div>

            <label className="mb-2 block text-sm font-medium text-foreground">
              Top P
            </label>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Focused</span>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={settings.topP}
                onChange={(e) => update({ topP: parseFloat(e.target.value) })}
                className="flex-1 accent-foreground"
              />
              <span className="text-sm text-muted-foreground">Broad</span>
            </div>
            <div className="mb-4 text-center text-base font-semibold text-foreground">
              {settings.topP.toFixed(2)}
            </div>

            <label className="mb-2 block text-sm font-medium text-foreground">
              Max Output Tokens
            </label>
            <input
              type="number"
              min="64"
              max="2048"
              step="32"
              value={settings.maxOutputTokens}
              onChange={(e) => update({ maxOutputTokens: Math.max(64, Math.min(2048, Number(e.target.value) || 300)) })}
              className="mb-3 w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="300"
            />

            <label className="mb-2 block text-sm font-medium text-foreground">
              Context Messages
            </label>
            <input
              type="number"
              min="4"
              max="40"
              step="1"
              value={settings.contextMessages}
              onChange={(e) => update({ contextMessages: Math.max(4, Math.min(40, Number(e.target.value) || 12)) })}
              className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="12"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Controls how many recent messages are sent as conversation memory per request.
            </p>
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
