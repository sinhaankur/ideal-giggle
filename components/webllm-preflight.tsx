"use client"

import { useEffect, useState } from "react"
import { Download, HardDrive, X, Wrench } from "lucide-react"

// Approximate compressed weight sizes for the models we expose. Numbers are
// best-effort: WebLLM downloads quantized shards plus tokenizer + WASM,
// real totals can drift by ~10%.
const MODEL_SIZE_BYTES: Record<string, number> = {
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC": 360 * 1024 * 1024,
  "Llama-3.2-1B-Instruct-q4f16_1-MLC": 740 * 1024 * 1024,
  "Llama-3.2-3B-Instruct-q4f16_1-MLC": 1.95 * 1024 * 1024 * 1024,
  "gemma-2-2b-it-q4f16_1-MLC": 1.55 * 1024 * 1024 * 1024,
  "Mistral-7B-Instruct-v0.3-q4f16_1-MLC": 4.4 * 1024 * 1024 * 1024,
}

interface WebLLMPreflightProps {
  modelId: string
  onConfirm: () => void
  onDismiss: () => void
  onPickSmaller?: () => void
  onSwitchToOllama?: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "uncertain"
  if (seconds < 60) return `~${Math.round(seconds)}s`
  if (seconds < 60 * 60) return `~${Math.round(seconds / 60)} min`
  return `~${(seconds / 3600).toFixed(1)} h`
}

export function WebLLMPreflight({
  modelId,
  onConfirm,
  onDismiss,
  onPickSmaller,
  onSwitchToOllama,
}: WebLLMPreflightProps) {
  const [downlinkMbps, setDownlinkMbps] = useState<number | null>(null)

  useEffect(() => {
    if (typeof navigator === "undefined") return
    const conn = (
      navigator as Navigator & {
        connection?: { downlink?: number }
      }
    ).connection
    if (!conn || typeof conn.downlink !== "number") return
    setDownlinkMbps(conn.downlink)
  }, [])

  const sizeBytes = MODEL_SIZE_BYTES[modelId] ?? 700 * 1024 * 1024
  const sizeLabel = formatBytes(sizeBytes)
  const etaSeconds =
    downlinkMbps && downlinkMbps > 0
      ? (sizeBytes * 8) / (downlinkMbps * 1_000_000)
      : NaN
  const etaLabel = formatDuration(etaSeconds)

  return (
    <div
      className="border-b border-violet-500/30 bg-violet-500/5 px-4 py-3"
      role="region"
      aria-label="WebLLM download pre-flight"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 text-violet-200">
          <HardDrive className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] uppercase tracking-wide">
              Browser model not yet downloaded
            </span>
            <span className="text-[12px] leading-relaxed text-foreground">
              <span className="font-semibold">{modelId}</span> needs ~{sizeLabel}.
              {downlinkMbps
                ? ` On your current network (~${downlinkMbps.toFixed(1)} Mbps), that is ${etaLabel}.`
                : " Download time depends on your connection."}
            </span>
            <span className="mt-1 text-[11px] text-muted-foreground">
              Weights cache in IndexedDB so this only happens once. After that everything runs offline.
            </span>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Hide pre-flight"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={onConfirm}
          className="inline-flex items-center gap-1 rounded border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-100 transition-colors hover:bg-violet-500/25"
        >
          <Download className="h-3 w-3" />
          Download &amp; initialize
        </button>
        {onPickSmaller && (
          <button
            onClick={onPickSmaller}
            className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Wrench className="h-3 w-3" />
            Pick smaller model
          </button>
        )}
        {onSwitchToOllama && (
          <button
            onClick={onSwitchToOllama}
            className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-background/40 px-2 py-1 text-[11px] uppercase tracking-wide text-emerald-200 transition-colors hover:bg-emerald-500/20"
            title="Use a local Ollama daemon instead — no download into the browser"
          >
            Use Ollama instead
          </button>
        )}
      </div>
    </div>
  )
}
