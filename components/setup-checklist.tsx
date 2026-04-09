"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, CircleAlert, Loader2, RefreshCw } from "lucide-react"
import type { CompanionSettings } from "@/lib/companion-types"

type CheckState = "ok" | "warning" | "pending"

interface SetupChecklistProps {
  settings: CompanionSettings
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
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">{label}</div>
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

export function SetupChecklist({ settings }: SetupChecklistProps) {
  const [checkingOllama, setCheckingOllama] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true"

  const browserChecks = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        mediaDevices: false,
        webGpu: false,
      }
    }

    return {
      mediaDevices: !!navigator.mediaDevices?.getUserMedia,
      webGpu: "gpu" in navigator,
    }
  }, [])

  const checkOllama = async () => {
    setCheckingOllama(true)
    try {
      const base = settings.ollamaBaseUrl.replace(/\/$/, "")
      const tagsUrl = base.endsWith("/api") ? `${base}/tags` : `${base}/api/tags`

      if (isStaticExport) {
        const response = await fetch(tagsUrl, {
          method: "GET",
          cache: "no-store",
        })

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
  }

  return (
    <div className="mt-4 rounded border border-border bg-card p-4">
      <div className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground">SETUP CHECKLIST</div>

      <StatusLine
        label="Camera"
        state={browserChecks.mediaDevices ? "ok" : "warning"}
        detail={
          browserChecks.mediaDevices
            ? "Camera API available. Use Start Camera in Camera panel."
            : "Camera API not available in this browser or context."
        }
      />

      <StatusLine
        label="Provider"
        state="ok"
        detail={`Current provider: ${settings.provider.toUpperCase()}`}
      />

      {settings.provider === "webllm" && (
        <StatusLine
          label="WebLLM Runtime"
          state={browserChecks.webGpu ? "ok" : "warning"}
          detail={
            browserChecks.webGpu
              ? `WebGPU detected. Model ${settings.webllmModel} can run in browser.`
              : "WebGPU not detected. WebLLM may be slow or unavailable in this browser."
          }
        />
      )}

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
