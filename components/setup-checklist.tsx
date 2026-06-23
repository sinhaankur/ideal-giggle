"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, ChevronDown, CircleAlert, Copy, Download, Info, Loader2, RefreshCw } from "lucide-react"
import type { CompanionSettings } from "@/lib/companion-types"
import { isWebLLMSupported } from "@/lib/api/webllm-direct"

// "info" reads as neutral/optional (a capability that's available but not
// required), distinct from "warning" which signals something the user may
// actually want to act on.
type CheckState = "ok" | "warning" | "pending" | "info"

interface SetupChecklistProps {
  settings: CompanionSettings
  runtime: {
    isLoading: boolean
    llmConnectionError: string
  }
}

interface OllamaStatus {
  reachable: boolean
  modelAvailable: boolean
  modelCount: number
  error?: string
}

function StatusLine({ label, state, detail }: { label: string; state: CheckState; detail: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-b-0">
      <div className="flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-foreground">{label}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">{detail}</div>
      </div>
      <div className="pt-0.5">
        {state === "ok" ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : state === "warning" ? (
          <CircleAlert className="h-4 w-4 text-amber-500" />
        ) : state === "info" ? (
          <Info className="h-4 w-4 text-sky-400" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  )
}

function CommandRow({
  label,
  command,
  onCopy,
  copied,
}: {
  label: string
  command: string
  onCopy: () => void
  copied: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground">
          {command}
        </code>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-accent"
        >
          <Copy className="h-3 w-3" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  )
}

export function SetupChecklist({ settings, runtime }: SetupChecklistProps) {
  const [checkingOllama, setCheckingOllama] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [copiedCommand, setCopiedCommand] = useState("")
  // Ollama is an optional "max privacy" upgrade on the web build; keep it
  // tucked away so first-time visitors aren't greeted by terminal commands
  // and red errors for infrastructure they don't need.
  const [ollamaOpen, setOllamaOpen] = useState(settings.provider === "ollama")
  const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true"

  // WebGPU presence decides whether the in-browser model can run. When it
  // can't, the app still works via the deterministic engine — so we frame the
  // absence as "limited", never as a failure.
  const [webgpuSupported, setWebgpuSupported] = useState<boolean | null>(null)
  useEffect(() => {
    setWebgpuSupported(isWebLLMSupported())
  }, [])

  const copyCommand = useCallback(async (command: string) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopiedCommand(command)
      window.setTimeout(() => setCopiedCommand(""), 1400)
    } catch {
      setCopiedCommand("")
    }
  }, [])

  const hasMediaDevices =
    typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia)

  const checkOllama = useCallback(async () => {
    setCheckingOllama(true)
    try {
      const base = settings.ollamaBaseUrl.replace(/\/$/, "")
      const tagsUrl = base.endsWith("/api") ? `${base}/tags` : `${base}/api/tags`

      if (isStaticExport) {
        const response = await fetch(tagsUrl, { method: "GET", cache: "no-store" })
        if (!response.ok) {
          setOllamaStatus({
            reachable: false,
            modelAvailable: false,
            modelCount: 0,
            error: `Ollama responded with status ${response.status}`,
          })
          return
        }
        const data = await response.json()
        const models = Array.isArray(data?.models) ? data.models : []
        const names = models
          .map((entry: { model?: string; name?: string }) => entry.model || entry.name || "")
          .filter(Boolean)
        const modelAvailable = names.some((name: string) =>
          name.toLowerCase().includes(settings.ollamaModel.toLowerCase())
        )
        setOllamaStatus({
          reachable: true,
          modelAvailable,
          modelCount: names.length,
        })
        return
      }

      const params = new URLSearchParams({
        baseUrl: settings.ollamaBaseUrl,
        model: settings.ollamaModel,
      })
      const response = await fetch(`/api/ollama-status?${params.toString()}`)
      const data = (await response.json()) as OllamaStatus
      setOllamaStatus(data)
    } catch {
      setOllamaStatus({
        reachable: false,
        modelAvailable: false,
        modelCount: 0,
        error: "Unable to query local Ollama endpoint",
      })
    } finally {
      setCheckingOllama(false)
    }
  }, [settings.ollamaBaseUrl, settings.ollamaModel, isStaticExport])

  // Only probe Ollama when it's actually relevant: the user is on the Ollama
  // provider, or they've expanded the optional Ollama section to set it up.
  useEffect(() => {
    if (settings.provider !== "ollama" && !ollamaOpen) return
    const timeout = window.setTimeout(() => {
      checkOllama()
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [settings.provider, ollamaOpen, settings.ollamaBaseUrl, settings.ollamaModel, checkOllama])

  const cameraReady = hasMediaDevices
  const webllmActive = settings.provider === "webllm"

  return (
    <div className="mt-4 rounded border border-border bg-card p-4">
      <div className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground">STATUS</div>

      {/* In-browser AI — the zero-setup default. Lead with the reassuring,
          "you're good to go" state rather than a list of things to install. */}
      {webllmActive && (
        <StatusLine
          label="In-Browser AI"
          state={webgpuSupported === false ? "info" : "ok"}
          detail={
            webgpuSupported === false
              ? "This browser has no WebGPU, so replies use the built-in offline companion engine. For the full AI model, open EMPATHEIA in Chrome, Edge, or Arc."
              : "Ready — a private AI model runs entirely in this browser. No install, nothing leaves your device. The first reply loads the model, then it's fast and works offline."
          }
        />
      )}

      <StatusLine
        label="Camera"
        state={cameraReady ? "ok" : "info"}
        detail={
          cameraReady
            ? "Optional. Press Start Camera to let EMPATHEIA read your expression."
            : "Optional. Camera isn't available here — everything works without it."
        }
      />

      {settings.provider !== "webllm" && (
        <StatusLine
          label="Provider"
          state={
            runtime.llmConnectionError
              ? "warning"
              : runtime.isLoading
                ? "pending"
                : settings.provider === "openrouter" && !settings.openRouterApiKey.trim()
                  ? "warning"
                  : "ok"
          }
          detail={
            runtime.llmConnectionError
              ? `Provider error: ${runtime.llmConnectionError}`
              : runtime.isLoading
                ? `Current provider: ${settings.provider.toUpperCase()} (processing request...)`
                : settings.provider === "openrouter" && !settings.openRouterApiKey.trim()
                  ? "OpenRouter selected but API key is empty in Settings."
                  : `Current provider: ${settings.provider.toUpperCase()} ready.`
          }
        />
      )}

      {/* Optional "max privacy" upgrade. Collapsed by default on the web so
          first-time visitors aren't confronted with terminal commands. */}
      <div className="mt-3 border-t border-border/60 pt-3">
        <button
          onClick={() => setOllamaOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={ollamaOpen}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground">
              Run it 100% on your machine
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Optional. Install Ollama for a larger, higher-quality private model.
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${ollamaOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {ollamaOpen && (
        <div className="mt-3">
          <StatusLine
            label="Ollama Endpoint"
            state={
              checkingOllama
                ? "pending"
                : ollamaStatus?.reachable
                  ? "ok"
                  : "info"
            }
            detail={
              checkingOllama
                ? "Checking local runtime..."
                : ollamaStatus?.reachable
                  ? `Connected. ${ollamaStatus.modelCount} model(s) found.`
                  : ollamaStatus?.error
                    ? `Not running yet — ${ollamaStatus.error}. Follow the steps below to enable it.`
                    : "Not running yet. Follow the steps below to enable it."
            }
          />

          <StatusLine
            label="Ollama Model"
            state={
              checkingOllama
                ? "pending"
                : ollamaStatus?.modelAvailable
                  ? "ok"
                  : "info"
            }
            detail={
              checkingOllama
                ? `Checking model ${settings.ollamaModel}...`
                : ollamaStatus?.modelAvailable
                  ? `${settings.ollamaModel} is available locally.`
                  : `Model ${settings.ollamaModel} not installed yet.`
            }
          />

          {(() => {
            const phase: "stopped" | "no-model" | "ready" =
              ollamaStatus?.reachable === false || ollamaStatus === null
                ? "stopped"
                : ollamaStatus?.modelAvailable
                  ? "ready"
                  : "no-model"
            const pullCmd = `ollama pull ${settings.ollamaModel}`
            const runCmd = `ollama run ${settings.ollamaModel}`
            const startCmd = "ollama serve"

            return (
              <div className="mt-3 space-y-3 rounded border border-border bg-background p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {phase === "stopped" && "Step 1 — start Ollama"}
                    {phase === "no-model" && "Step 2 — get a model"}
                    {phase === "ready" && "Connected — lifecycle commands"}
                  </div>
                  <span
                    className={`text-[11px] uppercase tracking-wide ${
                      phase === "ready" ? "text-emerald-500" : "text-sky-400"
                    }`}
                  >
                    {phase === "ready" ? "ready" : "optional"}
                  </span>
                </div>

                {phase === "stopped" && (
                  <>
                    <p className="text-[11px] text-muted-foreground">
                      Browsers cannot start the Ollama daemon directly. Run this in your terminal once, then click Verify.
                    </p>
                    <CommandRow
                      label="Start daemon"
                      command={startCmd}
                      copied={copiedCommand === startCmd}
                      onCopy={() => copyCommand(startCmd)}
                    />
                  </>
                )}

                {phase === "no-model" && (
                  <CommandRow
                    label={`Install ${settings.ollamaModel}`}
                    command={pullCmd}
                    copied={copiedCommand === pullCmd}
                    onCopy={() => copyCommand(pullCmd)}
                  />
                )}

                {phase === "ready" && (
                  <>
                    <CommandRow
                      label="Run interactively"
                      command={runCmd}
                      copied={copiedCommand === runCmd}
                      onCopy={() => copyCommand(runCmd)}
                    />
                    <CommandRow
                      label={`Update / refresh weights for ${settings.ollamaModel}`}
                      command={pullCmd}
                      copied={copiedCommand === pullCmd}
                      onCopy={() => copyCommand(pullCmd)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Re-running pull periodically pulls the latest tag if the model has been updated upstream.
                    </p>
                  </>
                )}

                {(phase === "stopped" || phase === "no-model") && (
                  <Link
                    href="/ollama-install"
                    className="inline-flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Install your own private LLM
                  </Link>
                )}
              </div>
            )
          })()}

          <button
            onClick={checkOllama}
            disabled={checkingOllama}
            className="mt-3 inline-flex items-center gap-2 rounded border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checkingOllama ? "animate-spin" : ""}`} />
            Verify Ollama
          </button>
        </div>
      )}
    </div>
  )
}
