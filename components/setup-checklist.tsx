"use client"

import { useEffect, useMemo, useState } from "react"
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

interface WebGpuDiagnostic {
  hasNavigatorGpu: boolean
  adapterAvailable: boolean
  deviceAvailable: boolean
  adapterName?: string
  limitsSummary?: string
  message: string
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
  const [storageAvailableGb, setStorageAvailableGb] = useState<number | null>(null)
  const [checkingWebGpu, setCheckingWebGpu] = useState(false)
  const [webGpuDiagnostic, setWebGpuDiagnostic] = useState<WebGpuDiagnostic | null>(null)
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

  const runWebGpuDiagnostic = async () => {
    setCheckingWebGpu(true)
    try {
      if (typeof navigator === "undefined") {
        setWebGpuDiagnostic({
          hasNavigatorGpu: false,
          adapterAvailable: false,
          deviceAvailable: false,
          message: "Navigator is unavailable in this context.",
        })
        return
      }

      const nav = navigator as Navigator & {
        gpu?: {
          requestAdapter: (options?: unknown) => Promise<any>
        }
      }

      if (!nav.gpu) {
        setWebGpuDiagnostic({
          hasNavigatorGpu: false,
          adapterAvailable: false,
          deviceAvailable: false,
          message: "WebGPU API is not exposed. Enable GPU acceleration/browser flags or use API/Ollama provider.",
        })
        return
      }

      const adapter = await nav.gpu.requestAdapter({
        powerPreference: "high-performance",
      })

      if (!adapter) {
        setWebGpuDiagnostic({
          hasNavigatorGpu: true,
          adapterAvailable: false,
          deviceAvailable: false,
          message: "WebGPU exists, but no adapter was returned. This usually indicates blocked GPU access or unsupported drivers.",
        })
        return
      }

      let deviceAvailable = false
      let message = "WebGPU adapter and device look healthy."
      try {
        await adapter.requestDevice()
        deviceAvailable = true
      } catch {
        message = "Adapter found but device creation failed. Try updating GPU drivers and closing heavy tabs/apps."
      }

      const infoObj = (adapter as any).info || {}
      const adapterName =
        infoObj.description ||
        infoObj.architecture ||
        infoObj.vendor ||
        "GPU adapter detected"
      const limits = (adapter as any).limits || {}
      const limitsSummary =
        typeof limits.maxStorageBufferBindingSize === "number"
          ? `maxStorageBufferBindingSize=${limits.maxStorageBufferBindingSize}`
          : "limits available"

      setWebGpuDiagnostic({
        hasNavigatorGpu: true,
        adapterAvailable: true,
        deviceAvailable,
        adapterName,
        limitsSummary,
        message,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown WebGPU diagnostic failure"
      setWebGpuDiagnostic({
        hasNavigatorGpu: true,
        adapterAvailable: false,
        deviceAvailable: false,
        message: msg,
      })
    } finally {
      setCheckingWebGpu(false)
    }
  }

  useEffect(() => {
    const run = async () => {
      if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
        setStorageAvailableGb(null)
        return
      }

      try {
        const estimate = await navigator.storage.estimate()
        const quota = estimate.quota ?? 0
        const usage = estimate.usage ?? 0
        const available = Math.max(0, quota - usage)
        setStorageAvailableGb(available / (1024 ** 3))
      } catch {
        setStorageAvailableGb(null)
      }
    }

    run()
  }, [])

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
        <>
          <StatusLine
            label="WebLLM Runtime"
            state={browserChecks.webGpu ? "ok" : "warning"}
            detail={
              browserChecks.webGpu
                ? `WebGPU detected. Model ${settings.webllmModel} can run in browser.`
                : "WebGPU not detected. Enable GPU acceleration and browser WebGPU settings, or switch to API/Ollama."
            }
          />

          {!browserChecks.webGpu && (
            <div className="mt-2 rounded border border-border bg-background p-3 text-[11px] text-muted-foreground">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                WebGPU Quick Fix
              </div>
              <div>1. Chrome/Edge: open chrome://settings/system and enable graphics acceleration.</div>
              <div>2. Chrome/Edge flags: enable #enable-unsafe-webgpu and (Linux/Windows) #enable-vulkan, then relaunch.</div>
              <div>3. Firefox: use latest version and set dom.webgpu.enabled=true in about:config.</div>
              <div>4. Update GPU drivers (NVIDIA/AMD/Intel) and verify support using webgpureport.org.</div>
              <div>5. If tabs crash, use a smaller model (1B/2B), close heavy tabs, and keep system cooled/powered.</div>
              <div className="mt-2">For higher stability, switch provider to OpenRouter API or Ollama local runtime.</div>
            </div>
          )}

          <StatusLine
            label="Storage Budget"
            state={
              storageAvailableGb === null
                ? "warning"
                : storageAvailableGb >= 3
                  ? "ok"
                  : "warning"
            }
            detail={
              storageAvailableGb === null
                ? "Storage estimate unavailable. Keep at least 2-5GB free for browser model downloads."
                : `${storageAvailableGb.toFixed(1)}GB available in browser storage estimate. Keep 2-5GB free for model shards.`
            }
          />

          <div className="mt-2 rounded border border-border bg-background p-3 text-[11px] text-muted-foreground">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
              No-Install Browser LLM Sites
            </div>
            <div>
              <a href="https://chat.webllm.ai" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                WebLLM Chat
              </a>{" "}
              - direct in-browser model download and GPU inference.
            </div>
            <div>
              <a href="https://huggingface.co/chat" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                Hugging Face Chat
              </a>{" "}
              - can run lightweight local/browser models in some modes.
            </div>
            <div>
              <a href="https://huggingface.co/spaces/webllm/web-llm-agent" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                WebLLM Agents Playground
              </a>{" "}
              - browser-native agent workflows.
            </div>
            <div className="mt-2">Use regular browser windows (not Incognito) so IndexedDB keeps model weights between sessions.</div>
            <div className="mt-1">Chrome Dev/Canary may provide Gemini Nano via experimental browser APIs for zero-download local prompts.</div>
          </div>

          <button
            onClick={runWebGpuDiagnostic}
            disabled={checkingWebGpu}
            className="mt-3 inline-flex items-center gap-2 rounded border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checkingWebGpu ? "animate-spin" : ""}`} />
            Run WebGPU Diagnostic
          </button>

          {webGpuDiagnostic && (
            <div className="mt-3 rounded border border-border bg-background p-3 text-[11px] text-muted-foreground">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                WebGPU Diagnostic Result
              </div>
              <div>API Exposed: {webGpuDiagnostic.hasNavigatorGpu ? "Yes" : "No"}</div>
              <div>Adapter: {webGpuDiagnostic.adapterAvailable ? "Found" : "Unavailable"}</div>
              <div>Device: {webGpuDiagnostic.deviceAvailable ? "Created" : "Unavailable"}</div>
              {webGpuDiagnostic.adapterName && <div>Adapter Info: {webGpuDiagnostic.adapterName}</div>}
              {webGpuDiagnostic.limitsSummary && <div>Limits: {webGpuDiagnostic.limitsSummary}</div>}
              <div className="mt-2">Likely Cause: {webGpuDiagnostic.message}</div>
            </div>
          )}
        </>
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
