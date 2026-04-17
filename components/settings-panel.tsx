"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Settings, Server, Cloud, Thermometer, User, Sparkles, Cpu, Download } from "lucide-react"
import type { CompanionSettings, AIProvider, Personality, ToneMode } from "@/lib/companion-types"

const WEBLLM_MODEL_PRESETS = [
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  "Llama-3.2-3B-Instruct-q4f16_1-MLC",
  "gemma-2-2b-it-q4f16_1-MLC",
  "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
]

const OPENROUTER_MODEL_PRESETS = [
  "qwen/qwen3-4b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-r1-distill-llama-70b:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "google/gemma-2-9b-it:free",
]

const PROVIDERS: { value: AIProvider; label: string; desc: string; icon: typeof Server }[] = [
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

const PERSONALITIES: { value: Personality; label: string; desc: string }[] = [
  { value: "warm", label: "WARM", desc: "Empathetic and caring" },
  { value: "analytical", label: "ANALYTICAL", desc: "Logical and precise" },
  { value: "playful", label: "PLAYFUL", desc: "Creative and fun" },
  { value: "professional", label: "DIRECT", desc: "Professional and concise" },
]

const TONE_MODES: { value: ToneMode; label: string; desc: string }[] = [
  { value: "casual", label: "CASUAL", desc: "Relaxed and everyday" },
  { value: "balanced", label: "BALANCED", desc: "Natural and clear" },
  { value: "deep", label: "DEEP", desc: "Reflective and probing" },
]

interface SettingsPanelProps {
  settings: CompanionSettings
  onSettingsChange: (settings: CompanionSettings) => void
  onClose: () => void
}

type LimiterStatusPayload = {
  ok: boolean
  limiter: {
    mode: "distributed" | "memory"
    policy: {
      windowMs: number
      routes: {
        global: number
        chat: number
        mcpFallback: number
      }
    }
    distributedConfigured: boolean
  }
  serverTime: string
}

export function SettingsPanel({ settings, onSettingsChange, onClose }: SettingsPanelProps) {
  const isProductionBuild = process.env.NODE_ENV === "production"
  const [limiterStatus, setLimiterStatus] = useState<LimiterStatusPayload | null>(null)
  const [limiterError, setLimiterError] = useState("")
  const [isLimiterLoading, setIsLimiterLoading] = useState(false)
  const [limiterTokenInput, setLimiterTokenInput] = useState("")

  const update = (partial: Partial<CompanionSettings>) => {
    onSettingsChange({ ...settings, ...partial })
  }

  const fetchLimiterStatus = useCallback(async () => {
    setIsLimiterLoading(true)
    setLimiterError("")

    try {
      const headers: Record<string, string> = {}
      if (limiterTokenInput.trim()) {
        headers["x-admin-token"] = limiterTokenInput.trim()
      }

      const response = await fetch("/api/limiter-status", { headers, cache: "no-store" })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === "string" ? payload.error : `Request failed (${response.status})`
        setLimiterStatus(null)
        setLimiterError(message)
        return
      }

      const payload = (await response.json()) as LimiterStatusPayload
      setLimiterStatus(payload)
    } catch {
      setLimiterStatus(null)
      setLimiterError("Unable to fetch limiter status.")
    } finally {
      setIsLimiterLoading(false)
    }
  }, [limiterTokenInput])

  useEffect(() => {
    fetchLimiterStatus()
  }, [fetchLimiterStatus])

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
              {PERSONALITIES.map((p) => (
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

          {/* Tone Mode */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <Sparkles className="h-4 w-4 text-foreground" />
              <span className="text-sm font-semibold text-foreground">
                Conversation Tone
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {TONE_MODES.map((tone) => (
                <button
                  key={tone.value}
                  onClick={() => update({ toneMode: tone.value })}
                  className={`flex items-center justify-between rounded border p-3 text-left text-sm transition-colors ${
                    settings.toneMode === tone.value
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <span className="font-bold text-foreground">{tone.label}</span>
                  <span className="text-xs text-muted-foreground">{tone.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Start Presets */}
          <div className="mb-6 rounded border border-border bg-background p-3">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <Sparkles className="h-4 w-4 text-foreground" />
              <span className="text-sm font-semibold text-foreground">
                Quick Start Presets
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() =>
                  onSettingsChange({
                    ...settings,
                    provider: "webllm",
                    webllmModel: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
                    toneMode: "casual",
                    personality: "warm",
                    temperature: 0.7,
                    maxOutputTokens: 220,
                  })
                }
                className="rounded border border-border px-3 py-2 text-left text-sm transition-colors hover:border-muted-foreground/40"
              >
                <div className="font-semibold text-foreground">Fast & Local</div>
                <div className="text-xs text-muted-foreground">No API setup. Best for quick and stable onboarding.</div>
              </button>
              <button
                onClick={() =>
                  onSettingsChange({
                    ...settings,
                    provider: "openrouter",
                    openRouterModel: "qwen/qwen3-4b:free",
                    toneMode: "balanced",
                    personality: "warm",
                    temperature: 0.6,
                    maxOutputTokens: 260,
                  })
                }
                className="rounded border border-border px-3 py-2 text-left text-sm transition-colors hover:border-muted-foreground/40"
              >
                <div className="font-semibold text-foreground">Balanced Cloud</div>
                <div className="text-xs text-muted-foreground">Recommended for most users. Smooth quality with low latency.</div>
              </button>
              <button
                onClick={() =>
                  onSettingsChange({
                    ...settings,
                    provider: "openrouter",
                    openRouterModel: "meta-llama/llama-3.3-70b-instruct:free",
                    toneMode: "deep",
                    personality: "analytical",
                    temperature: 0.7,
                    maxOutputTokens: 320,
                  })
                }
                className="rounded border border-border px-3 py-2 text-left text-sm transition-colors hover:border-muted-foreground/40"
              >
                <div className="font-semibold text-foreground">Deep Empathy</div>
                <div className="text-xs text-muted-foreground">Richer reflection quality for longer emotional conversations.</div>
              </button>
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
              {PROVIDERS.map((p) => {
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
                value={WEBLLM_MODEL_PRESETS.includes(settings.webllmModel) ? settings.webllmModel : "custom"}
                onChange={(e) => {
                  if (e.target.value !== "custom") {
                    update({ webllmModel: e.target.value })
                  }
                }}
                className="mb-2 w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {WEBLLM_MODEL_PRESETS.map((model) => (
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
              <p className="mt-2 text-xs text-amber-300/90">
                If the demo crashes, your GPU likely ran out of memory. Start with a smaller 1B or 0.5B model first.
              </p>
              <div className="mt-3 rounded border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                <div className="mb-1 font-semibold text-foreground">Official WebLLM Repositories</div>
                <div>
                  <a
                    href="https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Qwen2.5 0.5B (Instruct)
                  </a>{" "}
                  - best first test model for low-memory systems and crash recovery.
                </div>
                <div>
                  <a
                    href="https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Llama 3.2 3B (Instruct)
                  </a>{" "}
                  - deeper conversational shadow-work flows.
                </div>
                <div>
                  <a
                    href="https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Llama 3.2 1B (Instruct)
                  </a>{" "}
                  - lower-end hardware and quick onboarding.
                </div>
                <div>
                  <a
                    href="https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Gemma 2 2B
                  </a>{" "}
                  - warmer and creative persona tone.
                </div>
                <div>
                  <a
                    href="https://huggingface.co/mlc-ai/Mistral-7B-Instruct-v0.3-q4f16_1-MLC"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Mistral 7B v0.3
                  </a>{" "}
                  - complex analysis and richer code synthesis.
                </div>
              </div>
            </div>
          )}

          {/* MCP Fallback Settings */}
          {settings.provider === "webllm" && (
            <div className="mb-6 rounded border border-border bg-background p-3">
              <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                <Server className="h-4 w-4 text-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  MCP Fallback (Optional)
                </span>
              </div>

              <label className="mb-2 flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={settings.mcpAutoFallback}
                  onChange={(e) => update({ mcpAutoFallback: e.target.checked })}
                />
                <span>Use MCP server when WebLLM is unavailable</span>
              </label>

              <label className="mb-2 block text-sm font-medium text-foreground">
                MCP Base URL
              </label>
              <input
                type="text"
                value={settings.mcpBaseUrl}
                onChange={(e) => update({ mcpBaseUrl: e.target.value })}
                className="mb-3 w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="http://127.0.0.1:8787"
              />

              <label className="mb-2 block text-sm font-medium text-foreground">
                MCP Model
              </label>
              <input
                type="text"
                value={settings.mcpModel}
                onChange={(e) => update({ mcpModel: e.target.value })}
                className="mb-3 w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="gpt-4o-mini"
              />

              <label className="mb-2 block text-sm font-medium text-foreground">
                MCP API Key (optional)
              </label>
              <input
                type="password"
                value={settings.mcpApiKey}
                onChange={(e) => update({ mcpApiKey: e.target.value })}
                className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Leave blank for local MCP without auth"
              />

              <p className="mt-2 text-xs text-muted-foreground">
                This assumes your local MCP service exposes an OpenAI-compatible chat endpoint.
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
              <Link
                href="/ollama-install"
                className="ml-2 mt-3 inline-flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-foreground"
              >
                Guided Install + Emotion Setup
              </Link>
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
                placeholder={isProductionBuild ? "Optional in production when server key is configured" : "sk-or-v1-..."}
              />

              <label className="mb-2 block text-sm font-medium text-foreground">
                OpenRouter Model
              </label>
              <select
                value={OPENROUTER_MODEL_PRESETS.includes(settings.openRouterModel) ? settings.openRouterModel : "custom"}
                onChange={(e) => {
                  if (e.target.value !== "custom") {
                    update({ openRouterModel: e.target.value })
                  }
                }}
                className="mb-2 w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {OPENROUTER_MODEL_PRESETS.map((model) => (
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
                Uses OpenRouter hosted APIs for open-source models. In production, server-side OPENROUTER_API_KEY is recommended.
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

          <div className="mb-6 rounded border border-border bg-background p-3">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <Server className="h-4 w-4 text-foreground" />
              <span className="text-sm font-semibold text-foreground">Limiter Diagnostics</span>
            </div>

            <label className="mb-2 block text-sm font-medium text-foreground">Admin Token (optional)</label>
            <input
              type="password"
              value={limiterTokenInput}
              onChange={(e) => setLimiterTokenInput(e.target.value)}
              className="mb-3 w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Needed only if LIMITER_STATUS_TOKEN is set"
            />

            <button
              onClick={fetchLimiterStatus}
              disabled={isLimiterLoading}
              className="mb-3 w-full rounded border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              {isLimiterLoading ? "Refreshing..." : "Refresh Limiter Status"}
            </button>

            {limiterStatus && (
              <div className="rounded border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                <div>
                  Mode:{" "}
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-0.5 font-semibold uppercase tracking-[0.08em] ${
                      limiterStatus.limiter.mode === "distributed"
                        ? "border-emerald-300/70 bg-emerald-100/80 text-emerald-900"
                        : "border-amber-300/70 bg-amber-100/80 text-amber-900"
                    }`}
                  >
                    {limiterStatus.limiter.mode}
                  </span>
                </div>
                <div>
                  Window: <span className="font-semibold text-foreground">{Math.round(limiterStatus.limiter.policy.windowMs / 1000)}s</span>
                </div>
                <div>
                  Limits: <span className="font-semibold text-foreground">global {limiterStatus.limiter.policy.routes.global} / chat {limiterStatus.limiter.policy.routes.chat} / fallback {limiterStatus.limiter.policy.routes.mcpFallback}</span>
                </div>
                <div>
                  Distributed Configured: <span className="font-semibold text-foreground">{limiterStatus.limiter.distributedConfigured ? "yes" : "no"}</span>
                </div>
                {limiterStatus.limiter.mode === "memory" && (
                  <div className="mt-1 text-amber-300">
                    Running on single-instance memory limits.
                  </div>
                )}
              </div>
            )}

            {limiterError && <p className="text-xs text-amber-300">{limiterError}</p>}
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
