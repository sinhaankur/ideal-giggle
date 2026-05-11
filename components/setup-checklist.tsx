"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, CircleAlert, Copy, Download, Loader2, RefreshCw } from "lucide-react"
import type { CompanionSettings } from "@/lib/companion-types"

type CheckState = "ok" | "warning" | "pending"

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
  const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true"

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

  useEffect(() => {
    if (settings.provider !== "ollama") return
    const timeout = window.setTimeout(() => {
      checkOllama()
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [settings.provider, settings.ollamaBaseUrl, settings.ollamaModel, checkOllama])

  return (
    <div className="mt-4 rounded border border-border bg-card p-4">
      <div className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground">SETUP CHECKLIST</div>

      <StatusLine
        label="Camera"
        state={hasMediaDevices ? "ok" : "warning"}
        detail={
          hasMediaDevices
            ? "Camera API available. Use Start Camera in Camera panel."
            : "Camera API not available in this browser or context."
        }
      />

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

      {settings.provider === "ollama" && (
        <>
          <StatusLine
            label="Ollama Endpoint"
            state={
              checkingOllama
                ? "pending"
                : ollamaStatus?.reachable === false
                  ? "warning"
                  : ollamaStatus?.reachable
                    ? "ok"
                    : "warning"
            }
            detail={
              checkingOllama
                ? "Checking local runtime..."
                : ollamaStatus?.reachable
                  ? `Connected. ${ollamaStatus.modelCount} model(s) found.`
                  : ollamaStatus?.error || "Not checked yet. Click Verify Ollama."
            }
          />

          <StatusLine
            label="Ollama Model"
            state={
              checkingOllama
                ? "pending"
                : ollamaStatus?.modelAvailable
                  ? "ok"
                  : "warning"
            }
            detail={
              checkingOllama
                ? `Checking model ${settings.ollamaModel}...`
                : ollamaStatus?.modelAvailable
                  ? `${settings.ollamaModel} is available locally.`
                  : `Model ${settings.ollamaModel} not found. Run: ollama pull ${settings.ollamaModel}`
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
                    {phase === "stopped" && "Daemon not reachable"}
                    {phase === "no-model" && "Model not installed"}
                    {phase === "ready" && "Lifecycle commands"}
                  </div>
                  <span
                    className={`text-[11px] uppercase tracking-wide ${
                      phase === "ready"
                        ? "text-emerald-500"
                        : phase === "no-model"
                          ? "text-amber-500"
                          : "text-rose-400"
                    }`}
                  >
                    {phase === "ready" ? "ready" : phase === "no-model" ? "needs pull" : "needs start"}
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
        </>
      )}
    </div>
  )
}
