"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Settings, Server, Cloud, Thermometer, User, Sparkles, Cpu, Download } from "lucide-react"
import type { CompanionSettings, AIProvider, Personality, ToneMode } from "@/lib/companion-types"

// Free-tier model presets verified live against OpenRouter's catalog.
// Free models churn fast — when one returns "No endpoints found", swap
// it for another id from `curl https://openrouter.ai/api/v1/models | jq`.
const OPENROUTER_MODEL_PRESETS = [
  "openai/gpt-oss-20b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-4-26b-a4b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "z-ai/glm-4.5-air:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
]

// Two-path provider model: Ollama (local PC LLM) or a cloud API.
const PROVIDERS: { value: AIProvider; label: string; desc: string; icon: typeof Server }[] = [
  {
    value: "ollama",
    label: "Ollama (PC LLM)",
    desc: "Local LLM running on your own machine. Private, free, offline.",
    icon: Cpu,
  },
  {
    value: "openrouter",
    label: "OpenRouter (API)",
    desc: "Hosted open-source models via API. Has a free tier.",
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
  vaultStatus?: "no-vault" | "locked" | "unlocked"
  hasSessionMemory?: boolean
  onForgetSessionMemory?: () => void
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

export function SettingsPanel({
  settings,
  onSettingsChange,
  onClose,
  vaultStatus = "no-vault",
  hasSessionMemory = false,
  onForgetSessionMemory,
}: SettingsPanelProps) {
  const isProductionBuild = process.env.NODE_ENV === "production"
  const [limiterStatus, setLimiterStatus] = useState<LimiterStatusPayload | null>(null)
  const [limiterError, setLimiterError] = useState("")
  const [isLimiterLoading, setIsLimiterLoading] = useState(false)
  const [limiterTokenInput, setLimiterTokenInput] = useState("")
  type TabId = "start" | "provider" | "persona" | "memory"
  const [activeTab, setActiveTab] = useState<TabId>("start")
  const TABS: Array<{ id: TabId; label: string }> = [
    { id: "start", label: "Start" },
    { id: "provider", label: "Provider" },
    { id: "persona", label: "Persona" },
    { id: "memory", label: "Memory" },
  ]

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

        {/* Tab bar */}
        <div className="flex border-b border-border bg-background/50">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 border-b-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                activeTab === tab.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* PERSONA TAB: Identity / Companion Name */}
          {activeTab === "persona" && <>
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

          </>}

          {/* MEMORY TAB: Accessibility + Memory across sessions */}
          {activeTab === "memory" && <>
          <div className="mb-6 rounded border border-border bg-background p-3">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <Sparkles className="h-4 w-4 text-foreground" />
              <span className="text-sm font-semibold text-foreground">
                Accessibility
              </span>
            </div>

            <label className="mb-2 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={settings.accessibilityMode}
                onChange={(e) => update({ accessibilityMode: e.target.checked })}
              />
              <span>Enable accessibility UX mode</span>
            </label>

            <p className="text-xs text-muted-foreground">
              When enabled, reduced motion and keyboard shortcut assistance are activated.
            </p>
          </div>

          {/* Memory across sessions */}
          <div className="mb-6 rounded border border-border bg-background p-3">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <Sparkles className="h-4 w-4 text-foreground" />
              <span className="text-sm font-semibold text-foreground">
                Memory
              </span>
            </div>

            <label
              className={`mb-2 flex items-center gap-2 text-sm ${
                vaultStatus === "unlocked" ? "text-foreground" : "text-muted-foreground/60"
              }`}
            >
              <input
                type="checkbox"
                checked={settings.rememberSessions}
                disabled={vaultStatus !== "unlocked"}
                onChange={(e) => {
                  const next = e.target.checked
                  // Turning OFF should also delete what's already stored —
                  // off has to mean off. Confirm before destroying.
                  if (!next && hasSessionMemory) {
                    const ok = window.confirm(
                      "Disable remembering and delete the existing session memory from your vault?"
                    )
                    if (!ok) return
                    onForgetSessionMemory?.()
                  }
                  update({ rememberSessions: next })
                }}
              />
              <span>Remember conversations across sessions</span>
            </label>

            <p className="text-xs text-muted-foreground">
              When on, the last few turns and the most recent reflection summary are stored
              inside your encrypted vault so the next session can offer to pick up where you
              left off. Off by default. Memory only persists while the vault is unlocked.
            </p>

            {vaultStatus !== "unlocked" && (
              <p className="mt-2 text-xs text-amber-300">
                Unlock or create a vault first — memory needs encryption.
              </p>
            )}

            {settings.rememberSessions && hasSessionMemory && onForgetSessionMemory && (
              <button
                onClick={() => {
                  const ok = window.confirm(
                    "Forget all stored session memory? Your conversation will start fresh next time."
                  )
                  if (!ok) return
                  onForgetSessionMemory()
                }}
                className="mt-3 inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-300 transition-colors hover:bg-rose-500/20"
              >
                Forget all memory now
              </button>
            )}
          </div>

          </>}

          {/* START TAB: Quick Start Presets */}
          {activeTab === "start" && <>
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
                    provider: "ollama",
                    toneMode: "casual",
                    personality: "warm",
                    temperature: 0.7,
                    maxOutputTokens: 260,
                  })
                }
                className="rounded border border-border px-3 py-2 text-left text-sm transition-colors hover:border-muted-foreground/40"
              >
                <div className="font-semibold text-foreground">Local LLM (Ollama)</div>
                <div className="text-xs text-muted-foreground">Runs on your PC. Private, free, no API key.</div>
              </button>
              <button
                onClick={() =>
                  onSettingsChange({
                    ...settings,
                    provider: "ollama",
                    ollamaModel: "empathia-tiny",
                    toneMode: "casual",
                    personality: "warm",
                    temperature: 0.7,
                    maxOutputTokens: 260,
                  })
                }
                className="rounded border border-border px-3 py-2 text-left text-sm transition-colors hover:border-muted-foreground/40"
              >
                <div className="font-semibold text-foreground">Lite Empathy (TinyLlama)</div>
                <div className="text-xs text-muted-foreground">Lightweight local model (~600 MB), empathy-tuned. Build with scripts/empathia-tiny.Modelfile.</div>
              </button>
              <button
                onClick={() =>
                  onSettingsChange({
                    ...settings,
                    provider: "openrouter",
                    openRouterModel: "openai/gpt-oss-20b:free",
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

          </>}

          {/* PROVIDER TAB: AI Provider + Ollama + OpenRouter + Generation */}
          {activeTab === "provider" && <>
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
          </>}
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
